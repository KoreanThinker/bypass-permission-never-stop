# PRD: Claude Code "Bypass Permission Never Stop" Mode Injector

## 1. 프로젝트 개요 (Overview & Vision)

- **제품명**: `bypass-permission-never-stop` (NPM 패키지명 & GitHub 레포명 통일)
- **모드명**: **`bypass permission never stop`**
- **비전**: 잠든 사이, 주말 내내 Claude Code가 절대 쉬지 않고 코드를 리뷰하고, 테스트를 짜고, 리팩토링하게 만든다. 공식 지원하지 않는 UI(Shift+Tab)를 런타임 패치(Monkey Patching)로 뚫어버리는 **비공식 확장팩(God Mode)**.
- **핵심 차별점**: 프롬프트나 외부 래퍼(Wrapper) 툴을 쓰는 것이 아니라, 유저가 이미 익숙한 **공식 Claude Code의 Shift+Tab 사이클에 직접 침투**하는 압도적이고 매끄러운 UX.

> **Disclaimer**: 이 프로젝트는 Anthropic의 공식 제품이 아니며, Claude Code 바이너리를 런타임 패치합니다. Anthropic TOS 위반 가능성이 있으며, 사용자 책임 하에 사용해야 합니다. 교육 및 해킹 목적의 실험적 프로젝트입니다.

## 2. 타겟 유저 및 바이럴 전략

- **타겟 유저**: 퇴근 후 AI에게 일을 던져놓고 싶은 1인 개발자, 해커, 인디 메이커.
- **바이럴 포인트 (트위터/X)**:
  - "Claude Code에 숨겨진 무한 노동 모드를 언락하는 법"
  - 해키(Hacky)한 런타임 조작 방식 자체가 개발자들의 흥미(Geeky)를 강하게 자극.
  - "어제 `never stop` 모드 켜놓고 잤더니 아침에 PR이 50개 파여있음" 같은 밈(Meme) 생성 유도.

## 3. 핵심 유저 경험 (UX)

1. **설치 및 주입 (One-line Execution)**:
   ```bash
   npx bypass-permission-never-stop
   ```
   서브커맨드 없이 실행하면 바로 패치 시작. 간결한 해커 로그 스타일 출력:
   ```
   [*] Scanning for Claude Code installation...
   [*] Found: /opt/homebrew/lib/node_modules/@anthropic-ai/claude-code
   [*] Backing up cli.mjs (22.1MB)...
   [*] Patching mode cycle array...
   [*] Injecting never-stop hook...
   [+] Patch applied successfully. Run 'claude' and hit Shift+Tab.
   ```

2. **실행**: 평소처럼 `claude` 명령어 입력.

3. **모드 전환**: `Shift+Tab`을 누르면 기본 모드들(`default` → `acceptEdits` → `plan` → `bypassPermissions`)을 지나 마지막에 **`bypass permission never stop`** 모드가 등장.

4. **작동**: 프롬프트(예: "모든 파일 보안 취약점 점검하고 수정해")를 입력하면, 작업이 끝났다고 판단해도 내부 Hook이 이를 가로채 **직전에 유저가 입력한 메시지를 다시 주입**하여 강제로 다음 루프를 실행. (에러가 나도 스스로 고치며 무한 전진).

5. **종료**: 유일한 종료 방법은 유저가 직접 `Ctrl+C`를 누르는 것.

6. **롤백**:
   ```bash
   npx bypass-permission-never-stop uninstall
   ```

## 4. 기술 아키텍처 (Monkey Patching Mechanism)

이 프로젝트는 Claude Code를 포크(Fork)하지 않는다. 대신, 유저 컴퓨터에 설치된 패키지를 찾아내서 코드를 덮어씌운다.

### 타겟 파일 구조 (실제 분석 기반)

Claude Code의 핵심 코드는 **`cli.mjs` 단일 파일 번들 (약 22MB)**로 패키징되어 있다.
- 극도로 난독화(minified): 변수명 1~2글자 (`A`, `q`, `K`, `Y`)
- `dist/` 디렉토리에 파일이 분산되어 있지 않음 — **단일 진입점**
- 패치 대상은 이 `cli.mjs` 하나

### Phase 1: Target Finder (글로벌 패키지 추적기)

유저 시스템에 설치된 Claude Code의 물리적 경로를 동적으로 탐색.

**탐색 우선순위:**
1. `which claude` → 심볼릭 링크 역추적으로 패키지 루트 탐색
2. `npm root -g` → `@anthropic-ai/claude-code` 존재 여부 확인
3. Homebrew 경로: `/opt/homebrew/lib/node_modules/`, `/usr/local/lib/node_modules/`
4. Volta: `~/.volta/tools/image/packages/@anthropic-ai/claude-code/`
5. pnpm: `pnpm root -g`
6. yarn: `yarn global dir`
7. Anthropic 공식 installer: `~/.claude/` 하위 탐색

**출력:** `cli.mjs` 파일의 절대 경로

### Phase 2: AST / Regex Patcher (UI 하이재킹)

`cli.mjs`를 읽어들여 Shift+Tab 모드 사이클에 커스텀 모드를 주입.

- **목표 1 (UI)**: 퍼미션 모드 사이클을 담당하는 코드 패턴을 정규식으로 탐색. 난독화된 코드에서 `permissionMode` 관련 상태 전환 로직을 찾아 `"bypass permission never stop"` 모드를 `bypassPermissions` 바로 다음(마지막)에 삽입.
  - 모드 배열의 정확한 형태는 **버전별 코드 분석 후 확정** (난독화로 인해 고정 패턴 보장 불가)
  - 패턴 매칭 실패 시 에러 출력 후 안전 종료 (패치 미적용)
- **목표 2 (Logic)**: 해당 모드가 선택되었을 때 `bypassPermissions`와 동일한 권한 우회 플래그 활성화 + never-stop 플래그 추가 활성화.

### Phase 3: Hook Injector (무한 루프 주입)

`cli.mjs`에서 에이전트 종료/완료 로직을 찾아 덮어씌움 (Monkey Patch).

- **Stop 차단 + 메시지 재주입**: `bypass permission never stop` 모드에서 Claude가 작업을 끝내려고 하면 Stop 이벤트를 차단하고, **유저가 직전에 입력한 메시지를 다시 주입**하여 새로운 루프를 강제 시작.
- 컨텍스트 윈도우 관리는 Claude Code의 기본 compact 메커니즘에 위임.
- 난독화된 코드에서 Stop 관련 함수 식별 전략:
  - `stop`, `complete`, `finish`, `done` 등의 문자열 패턴 탐색
  - 에이전트 루프의 종료 조건 분기점 탐색
  - 패턴 매칭 실패 시 에러 출력 후 안전 종료

### Phase 4: Auto-Restorer (복구/롤백 메커니즘)

- `npx bypass-permission-never-stop uninstall` 시 패치 전 백업해둔 원본 `cli.mjs`로 롤백. (안전장치)
- 백업 위치: `~/.claude-never-stop/backups/`
- **최신 백업 1개만 유지** (이전 백업은 덮어씌움)
- 백업 시 원본 파일의 SHA-256 해시를 기록하여 무결성 검증

### Phase 5: Version Compatibility (버전 호환성 관리)

Claude Code는 빠르게 업데이트되며 (현재 v2.1.39), 난독화된 번들은 **업데이트마다 내부 구조가 변경**될 수 있다.

- **버전 감지**: 패치 전 `package.json`에서 Claude Code 버전 확인
- **패턴 시그니처 DB**: 버전별 패치 대상 정규식 패턴을 매핑 테이블로 관리 (**수동 유지**)
  ```
  signatures/
  ├── v2.1.x.json    # { "modeArrayPattern": "...", "stopLogicPattern": "..." }
  ├── v2.2.x.json
  └── generic.json   # 범용 패턴 (최후의 시도)
  ```
- **패치 실패 처리**: 패턴을 못 찾으면 패치를 적용하지 않고, 에러 메시지와 함께 지원 가능한 버전 목록을 출력 후 종료
- **자동 업데이트 감지**: 패치된 상태에서 Claude Code가 업데이트되면 다음 실행 시 경고 출력 (해시 불일치 감지)

## 5. 리스크 및 안전장치 (Failsafes)

- **비용 모니터링 경고**: `never stop` 모드 진입 시 터미널 상단에 빨간 글씨로 **Warning: This mode will consume tokens indefinitely until Ctrl+C.** 출력.
- **순환 오류 브레이커 (Circuit Breaker)**: 완전히 똑같은 에러 문자열이 **5번** 연속으로 발생하면 (exact string match) 토큰 낭비 무한 루프로 판단, 예외적으로 강제 종료(Exit)시키는 방어 코드 주입.
- **세션 로그**: never-stop 모드 동안의 모든 액션을 `~/.claude-never-stop/logs/` 에 **plain text (.log)** 로 타임스탬프와 함께 기록. 아침에 일어나서 `cat`으로 바로 확인 가능.

## 6. 법적 고지 (Legal Notice)

- Claude Code는 Anthropic PBC의 독점 소프트웨어이며, "All rights reserved" 라이선스 하에 배포됨.
- Anthropic Commercial TOS Section D.4는 "reverse engineer or duplicate the Services"를 금지.
- 이 프로젝트는 **교육 및 실험 목적**이며, 사용으로 인한 법적 책임은 전적으로 사용자에게 있음.
- Anthropic이 유사 프로젝트를 테이크다운한 선례가 있음 (소스맵 복원 프로젝트 등).

## 7. 선행 기술 (Prior Art)

| 프로젝트 | 접근법 | 우리와의 차이 |
|----------|--------|--------------|
| `claude-code-reverse` | `cli.js` 내부 SDK 코드 monkey-patch (API 로깅) | 로깅만 함, 동작 변경 없음 |
| `claude-trace` | `global.fetch` monkey-patch (네트워크 인터셉트) | 네트워크 레벨, UI 미조작 |
| `claude-code-extension-patcher` | VSCode 확장 패치 (`--dangerously-skip-permissions`) | IDE 확장 대상, CLI 아님 |
| `ufiaw` | `postinstall`로 `CLAUDE.md` 주입 (공급망 공격 데모) | 설정 파일만 수정, 바이너리 미수정 |

**우리의 차별점**: Shift+Tab 모드 사이클 UI에 직접 침투 + Stop 이벤트 차단 + 직전 메시지 재주입 조합. 이 세 가지를 동시에 하는 도구는 없음.

## 8. 프로젝트 구조

```
bypass-permission-never-stop/
├── docs/
│   └── PRD.md                    # 이 문서
├── signatures/
│   ├── v2.1.x.json               # 버전별 패치 패턴 시그니처
│   └── generic.json              # 범용 패턴
├── src/
│   ├── cli.ts                    # CLI 엔트리포인트 (기본: install / uninstall)
│   ├── index.ts                  # 메인 오케스트레이터
│   ├── finder/
│   │   └── target-finder.ts      # Phase 1: Claude Code 설치 경로 탐색
│   ├── patcher/
│   │   ├── ui-patcher.ts         # Phase 2: Shift+Tab 모드 배열 주입
│   │   └── hook-injector.ts      # Phase 3: 무한 루프 Hook 주입 + 메시지 재주입
│   ├── backup/
│   │   └── backup-manager.ts     # Phase 4: 백업/롤백 관리 (최신 1개)
│   ├── version/
│   │   └── compatibility.ts      # Phase 5: 버전 감지 및 시그니처 매칭
│   └── utils/
│       ├── logger.ts             # 해커 로그 출력 ([*] Scanning... [+] Done.)
│       ├── circuit-breaker.ts    # 순환 오류 감지 (exact match, 5회)
│       └── session-logger.ts     # 세션 액션 로그 기록 (plain text .log)
├── tests/
│   ├── target-finder.test.ts
│   ├── ui-patcher.test.ts
│   ├── hook-injector.test.ts
│   ├── backup-manager.test.ts
│   └── compatibility.test.ts
├── package.json
├── tsconfig.json
├── CLAUDE.md
├── LICENSE                       # MIT
└── .gitignore
```

## 9. 배포 전략

- **NPM**: `npx bypass-permission-never-stop`으로 설치 (메인 채널)
- **GitHub Releases**: 버전 태그별 바이너리 배포
- **README**: 해킹 UI 애니메이션 GIF + never-stop 모드 동작 데모 GIF 포함

## 10. 마일스톤

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 0 | Claude Code `cli.mjs` 리버스 엔지니어링 (모드 배열, Stop 로직 위치 확정) | TODO |
| Phase 1 | Target Finder - Claude Code 설치 경로 탐색 | TODO |
| Phase 2 | UI Patcher - Shift+Tab 모드 배열 주입 (bypassPermissions 다음) | TODO |
| Phase 3 | Hook Injector - 무한 루프 로직 주입 + 직전 메시지 재주입 | TODO |
| Phase 4 | Backup Manager - 백업/롤백 메커니즘 (최신 1개) | TODO |
| Phase 5 | Version Compatibility - 버전 감지 및 시그니처 관리 (수동) | TODO |
| Phase 6 | CLI & 해커 로그 UI | TODO |
| Phase 7 | 테스트 & NPM + GitHub Releases 배포 | TODO |

> **Phase 0가 가장 중요하다.** 난독화된 22MB `cli.mjs`에서 모드 배열과 Stop 로직의 정확한 위치/패턴을 찾아내는 리버스 엔지니어링이 전체 프로젝트의 성패를 결정한다. 이 Phase가 실패하면 나머지는 의미가 없다.
