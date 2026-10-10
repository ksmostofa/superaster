# Fresh source installation

The source commit and reproduction commands are in [summary.json](summary.json). `scripts/cloud-setup.sh` installed the pinned lockfile, generated schemas, and built native/web output in a fresh clone with its own `node_modules`. The actual test result is **138 PASS / 0 FAIL / 3 SKIP** out of 141. The skipped inference checks are not acceptance passes.

This supplements the separate installed-tarball evidence at [primary-clean-package](../primary-clean-package/README.md). It does not award G7, phone support, quality, or offline model acceptance.
