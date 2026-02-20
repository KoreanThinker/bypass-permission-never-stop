# PRD: Claude Code "Bypass Permission Never Stop" Mode Injector

## 1. 프로젝트 개요 (Overview & Vision)

- **제품명 (가칭)**: `claude-never-stop` (NPM 패키지명)
- **모드명**: **`bypass permission never stop`**
- **비전**: 잠든 사이, 주말 내내 Claude Code가 절대 쉬지 않고 코드를 리뷰하고, 테스트를 짜고, 리팩토링하게 만든다. 공식 지원하지 않는 UI(Shift+Tab)를 런타임 패치(Monkey Patching)로 뚫어버리는 **비공식 확장팩(God Mode)**.
- **핵심 차별점**: 프롬프트나 외부 래퍼(Wrapper) 툴을 쓰는 것이 아니라, 유저가 이미 익숙한 **공식 Claude Code의 Shift+Tab 사이클에 직접 침투**하는 압도적이고 매끄러운 UX.

## 2. 타겟 유저 및 바이럴 전략

- **타겟 유저**: 퇴근 후 AI에게 일을 던져놓고 싶은 1인 개발자, 해커, 인디 메이커.
- **바이럴 포인트 (트위터/X)**:
  - "Claude Code에 숨겨진 무한 노동 모드를 언락하는 법"
  - 해키(Hacky)한 런타임 조작 방식 자체가 개발자들의 흥미(Geeky)를 강하게 자극.
  - "어제 `never stop` 모드 켜놓고 잤더니 아침에 PR이 50개 파여있음" 같은 밈(Meme) 생성 유도.

## 3. 핵심 유저 경험 (UX)

1. **설치 및 주입 (One-line Execution)**:
   ```bash
   npx claude-never-stop install
   ```
   *(터미널에 화려한 해킹 UI 애니메이션과 함께 패치 성공 메시지 출력)*

2. **실행**: 평소처럼 `claude` 명령어 입력.

3. **모드 전환**: `Shift+Tab`을 누르면 기본 모드들을 지나 마침내 **`bypass permission never stop`** 모드가 등장.

4. **작동**: 프롬프트(예: "모든 파일 보안 취약점 점검하고 수정해")를 입력하면, 작업이 끝났다고 판단해도 내부 Hook이 이를 가로채 강제로 다음 루프를 실행. (에러가 나도 스스로 고치며 무한 전진).

5. **종료**: 유일한 종료 방법은 유저가 직접 `Ctrl+C`를 누르는 것.

## 4. 기술 아키텍처 (Monkey Patching Mechanism)

이 프로젝트는 Claude Code를 포크(Fork)하지 않는다. 대신, 유저 컴퓨터에 설치된 패키지를 찾아내서 코드를 덮어씌운다.

### Phase 1: Target Finder (글로벌 패키지 추적기)

- `npm root -g` 또는 `yarn global dir` 등을 실행하여 `@anthropic-ai/claude-code` 패키지의 물리적 설치 경로(`node_modules`)를 동적으로 스캔.

### Phase 2: AST / Regex Patcher (UI 하이재킹)

- 설치된 난독화된 JS 파일(`dist/` 내부 파일들)을 읽어들임.
- **목표 1 (UI)**: `Shift+Tab` 사이클을 담당하는 배열(예: `['default', 'auto-accept', 'plan', 'bypassPermissions']`)을 찾아 정규식이나 AST 파서(Babel/Esprima)로 `bypass permission never stop`을 강제 삽입.
- **목표 2 (Logic)**: 상태 관리 객체에 접근하여 해당 모드가 선택되었을 때의 플래그 처리 주입.

### Phase 3: Hook Injector (무한 루프 주입)

- `Stop Hook` 로직이 있는 함수를 찾아 덮어씌움 (Monkey Patch).
- **논리**: `if (currentMode === 'bypass permission never stop' && isTryingToStop) { return { decision: 'block', reason: 'Keep going, do not stop' }; }`

### Phase 4: Auto-Restorer (복구/롤백 메커니즘)

- `npx claude-never-stop uninstall` 시 패치 전 백업해둔 원본 JS 파일로 롤백. (안전장치)

## 5. 리스크 및 안전장치 (Failsafes)

아무리 해키하고 멈추지 않는 모드라도, **API 비용 폭탄($100~$1000)**을 맞으면 유저들이 쌍욕을 하며 이탈할 수 있어. 바이럴은 좋지만 파산은 막아야 해.

- **비용 모니터링 경고**: `never stop` 모드 진입 시 터미널 상단에 빨간 글씨로 ⚠️ **Warning: This mode will consume tokens indefinitely until Ctrl+C.** 출력.
- **순환 오류 브레이커 (Circuit Breaker)**: 완전히 똑같은 에러를 3번 이상 연속으로 발생시키며 무한 루프에 빠진 경우(토큰만 낭비하는 상태)에는 예외적으로 강제 종료(Exit)시키는 방어 코드 주입.

## 6. 프로젝트 구조

```
bypass-permission-never-stop/
├── docs/
│   └── PRD.md                    # 이 문서
├── src/
│   ├── cli.ts                    # CLI 엔트리포인트 (install/uninstall 커맨드)
│   ├── index.ts                  # 메인 오케스트레이터
│   ├── finder/
│   │   └── target-finder.ts      # Phase 1: Claude Code 설치 경로 탐색
│   ├── patcher/
│   │   ├── ui-patcher.ts         # Phase 2: Shift+Tab 모드 배열 주입
│   │   └── hook-injector.ts      # Phase 3: 무한 루프 Hook 주입
│   ├── backup/
│   │   └── backup-manager.ts     # Phase 4: 백업/롤백 관리
│   └── utils/
│       ├── logger.ts             # 해킹 UI 출력 (chalk + ora + boxen)
│       └── circuit-breaker.ts    # 순환 오류 감지 및 강제 종료
├── tests/
│   ├── target-finder.test.ts
│   ├── ui-patcher.test.ts
│   ├── hook-injector.test.ts
│   └── backup-manager.test.ts
├── package.json
├── tsconfig.json
├── LICENSE                       # MIT
└── .gitignore
```

## 7. 마일스톤

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | Target Finder - Claude Code 설치 경로 탐색 | TODO |
| Phase 2 | UI Patcher - Shift+Tab 모드 배열 주입 | TODO |
| Phase 3 | Hook Injector - 무한 루프 로직 주입 | TODO |
| Phase 4 | Backup Manager - 백업/롤백 메커니즘 | TODO |
| Phase 5 | CLI & 해킹 UI 애니메이션 | TODO |
| Phase 6 | 테스트 & NPM 배포 | TODO |
