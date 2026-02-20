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

## `claude` exits immediately with `killed`

Symptom:

```text
[1] 12345 killed     claude
```

Fix:

1. Restore from backup:

```bash
npx bypass-permission-never-stop uninstall
```

2. Verify Claude itself is healthy:

```bash
claude --version
```

3. If install reports `Native executable target detected`, do not patch that binary.
Use a JavaScript CLI install target instead.

## `Native executable target detected` during install

Cause:

- Your Claude target is a native executable (Mach-O/ELF/PE).
- In-place string patching can corrupt executable layout and make `claude` fail to start.

Fix:

- Keep native binary unmodified.
- Run `uninstall` if you previously patched it.
- Use a JavaScript CLI target when available.

## pnpm으로 Claude를 설치했는데 패치가 안 되는 경우

Symptoms:

- `which claude`는 `~/.local/share/claude/versions/...`(native binary)를 가리킴
- pnpm global에도 `@anthropic-ai/claude-code`가 설치되어 있음
- 패치가 binary 차단 메시지로 실패

Checks:

```bash
which claude
pnpm root -g
ls -la "$(pnpm root -g)/@anthropic-ai/claude-code"
```

Fix:

- `bypass-permission-never-stop`를 최신으로 업데이트 (`0.1.6+`)
- 최신 버전은 JS 타겟을 binary보다 우선 선택
- pnpm 글로벌 스토어 기반 설치(`@anthropic-ai/claude-code@2.1.49`) 시그니처를 지원
- 검증 스크립트 실행:

```bash
npm run qa:mixed
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

## `No compatible never-stop hook pattern found` 오류

Symptom:

```text
No compatible never-stop hook pattern found for this Claude CLI build.
```

Cause:

- 현재 설치된 Claude CLI 번들 구조가 훅 패턴과 맞지 않음.
- 이 경우 최신 버전에서는 부분 패치를 막기 위해 설치를 실패 처리함.

Fix:

- `bypass-permission-never-stop` 최신 버전으로 업데이트 (`0.1.6+`)
- Claude CLI 버전 확인 후(`claude --version` 또는 패키지 `version`) 대응 시그니처 지원 여부 확인
- 필요 시 `signatures/`와 훅 패턴을 해당 버전에 맞게 추가

## CI release fails on npm publish

Checklist:

- `NPM_TOKEN` secret exists in GitHub repo settings
- Token has publish permission
- Token supports bypass 2FA for publishing (or use trusted publishing)
- Release workflow triggered with `publish=true` when using `workflow_dispatch`
