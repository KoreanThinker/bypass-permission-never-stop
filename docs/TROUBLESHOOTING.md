# Troubleshooting

## npm publish fails with E403 (2FA bypass required)

Symptom:

```text
403 Forbidden ... Two-factor authentication or granular access token with bypass 2fa enabled is required
```

Fix options:

1. Publish with OTP directly:

```bash
npm publish --access public --otp <6-digit-code>
```

2. Use a granular token with publish + 2FA bypass:

- Create token in npm Access Tokens
- Grant publish permission to this package
- Enable `bypass 2FA for publishing`
- Store in GitHub Secret `NPM_TOKEN`

## `npx bypass-permission-never-stop` does nothing

Checks:

1. Ensure package version is current:

```bash
npm view bypass-permission-never-stop version
```

2. Verify command entrypoint:

```bash
npx -y bypass-permission-never-stop --help
```

3. Run with isolated HOME for deterministic testing:

```bash
H=$(mktemp -d)
HOME="$H" npx -y bypass-permission-never-stop --help
```

## Patch fails with missing patterns

Symptom:

```text
Patch failed: Pattern validation failed. Missing patterns: ...
```

Cause:

- Installed Claude Code binary differs from supported signatures.

Fix:

- Check version support in `signatures/`
- Add/update signature patterns for the new binary shape
- Re-run with backup/restore validation

## CI release fails on npm publish

Checklist:

- `NPM_TOKEN` secret exists in GitHub repo settings
- Token has publish permission
- Token supports bypass 2FA for publishing (or use trusted publishing)
- Release workflow triggered with `publish=true` when using `workflow_dispatch`
