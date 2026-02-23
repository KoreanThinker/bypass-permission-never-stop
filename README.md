# ♾️ bypass-permission-never-stop

[![CI](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/ci.yml/badge.svg)](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/ci.yml)
[![Release](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/release.yml/badge.svg)](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/release.yml)
[![Security Scan](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/security.yml/badge.svg)](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/security.yml)
[![npm version](https://badge.fury.io/js/bypass-permission-never-stop.svg)](https://www.npmjs.com/package/bypass-permission-never-stop)
[![npm download](https://img.shields.io/npm/dt/bypass-permission-never-stop)](https://www.npmjs.com/package/bypass-permission-never-stop)
[![License MIT](https://img.shields.io/github/license/KoreanThinker/bypass-permission-never-stop?style=flat)](LICENSE)
![Stars](https://img.shields.io/github/stars/KoreanThinker/bypass-permission-never-stop?style=social)

Installer that adds `BYPASS PERMISSION NEVER STOP` mode to Claude Code's Shift+Tab cycle.

## 🎬 Live demo

![BYPASS PERMISSION NEVER STOP mode demo](docs/assets/demo-never-stop.gif)

## ⚙️ How it works

- With `BYPASS PERMISSION NEVER STOP on`, one submitted message is re-submitted repeatedly.
- The loop continues while the Claude process and session are still active.

## ✨ Highlights

- 🚀 One-command install
- 🔁 Continuous re-submit loop mode
- ♻️ Safe rollback with `uninstall`

## Quick start

```bash
npx bypass-permission-never-stop
```

When prompted, type `yes` to install.

## Rollback

```bash
npx bypass-permission-never-stop uninstall
```

## Upgrade (best practice)

```bash
npx bypass-permission-never-stop upgrade
```

`upgrade` is the recommended path over manual `uninstall` + install.

## What you should see

1. Run `claude`
2. Press `Shift+Tab`
3. Confirm bottom mode text shows `BYPASS PERMISSION NEVER STOP on`

## CI / non-interactive install

```bash
npx bypass-permission-never-stop --yes
```

Use this only when you intentionally want unattended install.

## Sample prompt (one)

Use this once `BYPASS PERMISSION NEVER STOP` mode is enabled:

```text
Mission: Continuously find and fix real bugs from Sentry, GitHub issues, and direct code exploration; after each fix, immediately start the next bug cycle.
```

## Links

- Troubleshooting: `docs/TROUBLESHOOTING.md`
- QA details: `docs/QA_REPORT.md`
- Changelog: `CHANGELOG.md`
