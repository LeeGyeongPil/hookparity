# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-27

### Fixed
- `lint`, `list` and `match` now reject an invalid `--max-timeout` (usage error, exit 2) like `run` and `test`.

## [0.1.0] - 2026-11-15

### Known issues
- `--user` on a settings file without read permission prints a stack trace and exits 1 instead of exit 2.

### Added
- `list`, `match`, `run`, `test` and `lint` commands for pre-tool-use hooks of Claude Code, Codex CLI
  and Gemini CLI; Antigravity CLI is read as experimental.
- Config discovery for project files and, with `--user` / `--home`, user files (read-only), including
  Codex `config.toml` inline hooks.
- Per-agent matcher semantics, Claude Code `if` filters, stdin fixtures, exit-code and decision-JSON
  verdicts, and divergence reporting between agents.
- Lint rules HP001-HP009 and run-time findings HP101-HP105.
- `hookparity.cases.json` regression files with exit code 1 on mismatch.
- English and Korean output (`--lang`, `HOOKPARITY_LANG`, `LC_ALL` / `LC_MESSAGES` / `LANG`) and `--json`.
- `examples/crossagent` (shows a Gemini divergence) and `examples/fixed`.
