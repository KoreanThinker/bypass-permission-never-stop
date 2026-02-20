# ♾️ bypass-permission-never-stop

[![npm version](https://img.shields.io/npm/v/bypass-permission-never-stop?style=for-the-badge)](https://www.npmjs.com/package/bypass-permission-never-stop)
[![npm downloads](https://img.shields.io/npm/dw/bypass-permission-never-stop?style=for-the-badge)](https://www.npmjs.com/package/bypass-permission-never-stop)
[![CI](https://img.shields.io/github/actions/workflow/status/KoreanThinker/bypass-permission-never-stop/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/actions/workflow/status/KoreanThinker/bypass-permission-never-stop/release.yml?branch=main&style=for-the-badge&label=Release)](https://github.com/KoreanThinker/bypass-permission-never-stop/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/KoreanThinker/bypass-permission-never-stop?style=for-the-badge)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/KoreanThinker/bypass-permission-never-stop?style=for-the-badge)](https://github.com/KoreanThinker/bypass-permission-never-stop/stargazers)

Installer that adds `never stop` mode to Claude Code's Shift+Tab cycle.

## 🎬 Live demo

![Never stop mode demo](docs/assets/demo-never-stop.gif)

## ⚙️ How it works

- With `never stop on`, one submitted message is re-submitted repeatedly.
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

## What you should see

1. Run `claude`
2. Press `Shift+Tab`
3. Confirm bottom mode text shows `never stop on`

## CI / non-interactive install

```bash
npx bypass-permission-never-stop --yes
```

Use this only when you intentionally want unattended install.

## Sample prompt (one)

Use this once `never stop` mode is enabled:

```text
Mission: Continuously find and fix real bugs from Sentry, GitHub issues, and direct code exploration; after each fix, immediately start the next bug cycle.
```

## Links

- Troubleshooting: `docs/TROUBLESHOOTING.md`
- QA details: `docs/QA_REPORT.md`
- Changelog: `CHANGELOG.md`
