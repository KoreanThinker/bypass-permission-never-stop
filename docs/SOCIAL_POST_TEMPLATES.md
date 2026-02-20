# Social Post Templates

## X (Release)

> Shipped `bypass-permission-never-stop` v{{version}}.
>
> - Coverage-gated CI (90%+)
> - Published package smoke test
> - install/uninstall + backup/restore flow
>
> Quick start:
> `npx bypass-permission-never-stop`
>
> Repo: https://github.com/KoreanThinker/bypass-permission-never-stop

## Reddit (r/node, r/programming style)

Title:

`I built an unofficial Claude Code runtime patcher with backup/restore safety and CI-gated releases`

Body:

- What it does: adds a `neverStop` mode in the mode cycle
- Safety: backup manifest + uninstall restore
- QA: coverage-gated CI and smoke tests against published package
- Link: https://github.com/KoreanThinker/bypass-permission-never-stop

## Dev.to / Blog Snippet

### Hooking runtime behavior without forking

This project patches installed Claude Code runtime patterns, injects a custom mode path, and provides rollback safety. The release pipeline validates build/test/pack + published-package smoke tests before distribution.

- Quick start: `npx bypass-permission-never-stop`
- Rollback: `npx bypass-permission-never-stop uninstall`
- Repo: https://github.com/KoreanThinker/bypass-permission-never-stop

## Release Checklist for Posting

1. Confirm release tag and changelog
2. Copy one template and fill version/results
3. Include one CLI output snippet
4. Add repo link and troubleshooting link
