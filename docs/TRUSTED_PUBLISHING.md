# npm Trusted Publishing (GitHub Actions OIDC)

This removes long-lived npm publish tokens from CI.

## 1) Prepare repository workflow

The release workflow already requests:

- `permissions.id-token: write`

This is required for OIDC-based npm publish.

## 2) Configure npm trusted publisher

In npm package settings for `bypass-permission-never-stop`:

1. Open package settings
2. Go to `Trusted Publishers`
3. Add GitHub Actions publisher for:
   - owner: `KoreanThinker`
   - repo: `bypass-permission-never-stop`
   - workflow: `release.yml`
   - environment/branch rules as needed

## 3) Remove token dependency (optional)

After trusted publishing is confirmed:

- remove `NPM_TOKEN` secret
- publish from release workflow using OIDC path

## 4) Validate

1. Trigger release workflow with publish enabled
2. Confirm npm publish succeeded
3. Confirm provenance notice appears in logs

## Notes

- Keep fallback token path only if organization policy requires it.
- Rotate/revoke any previously leaked or obsolete npm tokens.
