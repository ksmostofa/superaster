#!/usr/bin/env python3
"""Audit an actual npm tarball without extracting it or executing package code."""
import argparse
import datetime
import hashlib
import json
import pathlib
import posixpath
import re
import subprocess
import tarfile


def digest(value):
    return hashlib.sha256(value).hexdigest()


def contents_of(path):
    with tarfile.open(path) as archive:
        members = archive.getmembers()
        names = [member.name for member in members]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate tar member names")
        contents = {}
        modes = {}
        for member in members:
            if member.isdir():
                continue
            if not member.isfile() or not member.name.startswith("package/"):
                raise ValueError(f"Unexpected tar member: {member.name}")
            name = member.name.removeprefix("package/")
            if posixpath.normpath(name) != name or name.startswith(("../", "/")):
                raise ValueError(f"Unsafe tar member: {member.name}")
            contents[name] = archive.extractfile(member).read()
            modes[name] = member.mode
        return contents, modes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--baseline", type=pathlib.Path)
    parser.add_argument("--baseline-audit", type=pathlib.Path,
                        help="Retained package inventory when the old tarball is unavailable")
    parser.add_argument("--baseline-lock", type=pathlib.Path,
                        help="Consumer lockfile retaining the old package declarations")
    parser.add_argument("--forbidden-sha256", action="append", default=[])
    args = parser.parse_args()
    forbidden = {value.lower() for value in args.forbidden_sha256}
    if any(not re.fullmatch(r"[0-9a-f]{64}", value) for value in forbidden):
        parser.error("--forbidden-sha256 requires a SHA-256 hex value")
    contents, modes = contents_of(args.package)
    names = sorted(contents)
    package = json.loads(contents["package.json"])
    checks = []

    def checked(identifier, failures, details=None):
        checks.append({"id": identifier, "status": "FAIL" if failures else "PASS",
                       "details": details if details is not None else failures})

    private = [name for name in names if "technical-spec" in name.lower()
               or name.startswith((".git/", ".cache/", "evidence/private/", ".env"))
               or name.endswith((".onnx", ".safetensors"))
               or digest(contents[name]) in forbidden]
    checked("private-package-exclusion", private)
    license_body = contents.get("LICENSE", b"")
    checked("application-license", not (b"Apache License" in license_body
            and b"Version 2.0" in license_body), {"sha256": digest(license_body)})
    manifest = json.loads(contents["third-party-licenses/manifest.json"])
    notices = []
    for entry in manifest["entries"]:
        name = "third-party-licenses/" + entry["path"]
        body = contents.get(name)
        notices.append({"path": name, "matches": body is not None
                        and len(body) == entry["bytes"]
                        and digest(body) == entry["sha256"]})
    checked("notice-manifest", not all(item["matches"] for item in notices), notices)
    broken = []
    link_count = 0
    for name in names:
        if not name.endswith(".md"):
            continue
        for label, target in re.findall(r"\[([^\]]+)\]\(([^)]+)\)",
                                      contents[name].decode(errors="replace")):
            target = target.strip().removeprefix("<").removesuffix(">")
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
                continue
            link_count += 1
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name),
                                                       target.split("#")[0]))
            if resolved not in contents and not any(p.startswith(resolved.rstrip("/") + "/")
                                                    for p in contents):
                broken.append({"file": name, "label": label, "target": target,
                               "resolved": resolved})
    checked("packaged-document-links", broken,
            {"checked_relative_links": link_count, "broken_links": broken})
    missing_imports = []
    runtime_dependencies = set()
    for name in names:
        if not name.startswith("dist/native/") or not name.endswith(".js"):
            continue
        source = contents[name].decode()
        targets = re.findall(r"(?:from\s+|import\s*(?:\(\s*)?)[\'\"]([^\'\"]+)[\'\"]", source)
        targets += re.findall(r"new URL\([\'\"]([^\'\"]+)[\'\"],\s*import\.meta\.url", source)
        for target in targets:
            if target.startswith("."):
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
                if resolved not in contents:
                    missing_imports.append({"file": name, "target": target,
                                            "resolved": resolved})
            elif not target.startswith("node:"):
                runtime_dependencies.add("/".join(target.split("/")[:2])
                                         if target.startswith("@") else target.split("/")[0])
    undeclared = sorted(runtime_dependencies - set(package.get("dependencies", {})))
    checked("native-runtime-import-closure", missing_imports or undeclared,
            {"missing_relative_imports": missing_imports,
             "imported_packages": sorted(runtime_dependencies),
             "undeclared_runtime_dependencies": undeclared})
    entries = package.get("bin", {}).values()
    exports = []
    for item in package.get("exports", {}).values():
        exports.extend(item.values() if isinstance(item, dict) else [item])
    missing_entries = [name for name in [*entries, *exports]
                       if name.removeprefix("./") not in contents]
    missing_shebang = [name for name in entries
                      if not contents.get(name.removeprefix("./"), b"").startswith(b"#!")]
    # npm's bin-links fixes executable permissions while linking installed bins;
    # tar mode alone does not establish whether that entrypoint is runnable.
    checked("public-entrypoints", missing_entries or missing_shebang,
            {"missing": missing_entries, "missing_bin_shebang": missing_shebang,
             "tar_bin_modes": {name: oct(modes.get(name.removeprefix("./"), 0))
                               for name in entries},
             "installed_bin_execution": "Requires a separate installed check"})
    required = ["schemas/recipe-1.0.json", "schemas/operation-1.0.json",
                "schemas/error-1.0.json", "schemas/image-info-1.0.json",
                "schemas/file-batch-1.0.json", "dist/native/catalog/data/presets.json"]
    missing = [name for name in required if name not in contents]
    checked("schemas-and-catalog", missing,
            {"missing": missing, "catalog_records": len(json.loads(contents[required[-1]]))
             if required[-1] in contents else 0})
    credit = contents.get("evidence/benchmarks/native-screening-baseline.md", b"")
    checked("fern-derivative-attribution",
            not all(value in credit for value in [b"Forest and Kim Starr",
                    b"CC BY 3.0 US", b"commons.wikimedia.org/wiki/File:Starr-100623",
                    b"Changes:"]),
            {"attribution_document": "evidence/benchmarks/native-screening-baseline.md",
             "sha256": digest(credit)})
    comparison = None
    if args.baseline:
        old, _ = contents_of(args.baseline)
        native_names = {name for name in names if name.startswith("dist/native/")} | {
            name for name in old if name.startswith("dist/native/")}
        changed = [name for name in sorted(native_names) if old.get(name) != contents.get(name)]
        old_package = json.loads(old["package.json"])
        changed_dependencies = {key: {"baseline": old_package.get(key), "candidate": package.get(key)}
                                for key in ["dependencies", "optionalDependencies", "engines"]
                                if old_package.get(key) != package.get(key)}
        comparison = {"baseline": str(args.baseline.resolve()),
                      "baseline_sha256": digest(args.baseline.read_bytes()),
                      "changed_native_files": changed,
                      "changed_runtime_dependency_declarations": changed_dependencies,
                      "unchanged_native_checks_reusable": not changed and not changed_dependencies}
    elif args.baseline_audit:
        old = json.loads(args.baseline_audit.read_text())
        old_files = {entry["path"]: entry["sha256"] for entry in old["files"]}
        native_names = {name for name in names if name.startswith("dist/native/")} | {
            name for name in old_files if name.startswith("dist/native/")}
        changed = [name for name in sorted(native_names)
                   if old_files.get(name) != (digest(contents[name]) if name in contents else None)]
        changed_dependencies = None
        if args.baseline_lock:
            lock = json.loads(args.baseline_lock.read_text())
            old_package = lock["packages"]["node_modules/" + package["name"]]
            changed_dependencies = {key: {"baseline": old_package.get(key),
                                          "candidate": package.get(key)}
                                    for key in ["dependencies", "optionalDependencies", "engines"]
                                    if old_package.get(key) != package.get(key)}
        comparison = {"baseline_inventory": str(args.baseline_audit.resolve()),
                      "baseline_inventory_sha256": digest(args.baseline_audit.read_bytes()),
                      "baseline_package_sha256": old["package_sha256"],
                      "baseline_tarball_available": False,
                      "changed_native_files": changed,
                      "changed_runtime_dependency_declarations": changed_dependencies,
                      "unchanged_native_checks_reusable": not changed
                      and changed_dependencies is not None and not changed_dependencies}
    try:
        head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        head = None
    report = {"checked_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "audit_script_sha256": digest(pathlib.Path(__file__).read_bytes()),
              "head": head, "package": str(args.package.resolve()),
              "package_sha256": digest(args.package.read_bytes()),
              "package_bytes": args.package.stat().st_size,
              "package_file_count": len(names), "checks": checks,
              "baseline_comparison": comparison,
              "files": [{"path": name, "bytes": len(contents[name]),
                         "sha256": digest(contents[name])} for name in names]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ["package", "package_sha256",
          "package_file_count", "checks", "baseline_comparison"]}, indent=2))
    return int(any(check["status"] == "FAIL" for check in checks))


if __name__ == "__main__":
    raise SystemExit(main())
