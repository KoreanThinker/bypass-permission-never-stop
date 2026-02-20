# Contributing Guide

Thanks for contributing.

## Local Setup

```bash
npm install
npm run build
npm run test:ci
```

## Quality Gate

All PRs must pass:

- `npm run build`
- `npm run test:ci` (coverage threshold enforced in `vitest.config.ts`)
- `npm pack --dry-run`

## Pull Request Rules

- Keep PR scope focused
- Add or update tests for behavior changes
- Avoid committing secrets or tokens
- Use clear commit messages

## Release Notes

If your change affects users, add a short summary in the PR description:

- what changed
- migration impact (if any)
- how it was tested
