"""Small shared helpers for reproducible benchmark preparation, not production processing."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent


def digest(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')


def resolve_input(path: str) -> Path:
    result = (ROOT / path).resolve()
    if not result.is_relative_to(ROOT):
        raise ValueError(f'Corpus input escapes repository: {path}')
    return result
