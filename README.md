# ♾️ bypass-permission-never-stop

Installer that adds `never stop` mode to Claude Code's Shift+Tab cycle.

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
