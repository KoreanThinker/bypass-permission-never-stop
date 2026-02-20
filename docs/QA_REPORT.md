# QA Report (2026-02-20)

## Scope

- Verify mixed installation environments where native Claude binary and pnpm JS install coexist.
- Verify regression safety for install/uninstall and target selection.
- Verify `@anthropic-ai/claude-code@2.1.49` signature and never-stop hook patch path.
- Verify tmux execution path.
- Verify Linux container test baseline.

## Environment

- Host: macOS (arm64)
- `pnpm`: `10.23.0`
- `tmux`: `3.6a`
- `docker`: `24.0.2`

## Executed QA

1. Automated suite:

```bash
npm run test:ci
```

Result: PASS (`146 tests`, coverage `91.65%` at run time).

2. Mixed target QA (local binary + pnpm JS):

```bash
npm run qa:mixed
```

Result: PASS.

Validated:

- Finder selects pnpm JS target.
- JS target patched (`neverStop` markers present).
- Local native binary remains untouched.
- `uninstall` restores JS target.

3. pnpm 2.1.49 mixed-target QA:

```bash
npm run qa:pnpm2149
```

Result: PASS.

Validated:

- Exact `2.1.49` signature selected over broad `2.1.x`.
- `eT6` mode cycle patch applied with `neverStop` transition.
- `zq1` mode display metadata includes `Never Stop`.
- `2.1.49` interactive hook injection path (`chat:submit` / `f6(...)` loop) applied.
- `uninstall` restores original JS target content.

4. tmux manual QA (same mixed scenario, separate tmux session):

Result: PASS.

Validated:

- Install succeeds in tmux execution context.
- JS target patched, local binary unchanged.
- Uninstall restores patched JS target.

5. tmux real interactive verification (`Shift+Tab` mode cycle):

Result: PASS.

Validated:

- `tmux` session에서 patch 적용 후 `claude --dangerously-skip-permissions` 실제 실행.
- 초기 trust/effort 프롬프트 통과 뒤 `Shift+Tab` 입력 반복.
- 화면 하단 상태줄에 `never stop on` 표시 확인.
- `hi` 제출 후 반복 응답/토큰 증가로 interactive never-stop 루프 동작 확인.

6. Docker Linux QA:

```bash
docker run --rm -v "$PWD:/work" -w /work node:24-bookworm bash -lc "npm ci --silent && npm run test:ci"
```

Result: PASS.

## Notes

- Native executable patching remains blocked by design for safety.
- Version `0.1.8` moves `2.1.49` hook to interactive submit path and verifies loop behavior in tmux.
