# Architecture

```text
User CLI
  |
  v
src/cli.ts
  |
  v
src/index.ts (Orchestrator)
  |
  +--> src/doctor/doctor.ts
  |      - run 10-step diagnostics
  |      - detect state inconsistencies
  |      - execute guided restore/reinstall flow
  |
  +--> src/finder/target-finder.ts
  |      - detect installed Claude Code target
  |      - resolve target type/version
  |
  +--> src/version/compatibility.ts
  |      - load signature set
  |      - validate search patterns
  |
  +--> src/backup/backup-manager.ts
  |      - create backup + manifest
  |      - restore original file on uninstall
  |
  +--> src/patcher/ui-patcher.ts
  |      - apply search/replace patches
  |      - preserve file permissions
  |
  +--> src/patcher/hook-injector.ts
         - inject bypass permission never stop loop hook
         - attach circuit-breaker logic
```

## Data Flow

1. CLI detects target path/type/version.
2. Signature matcher selects compatible patch set.
3. Backup manager snapshots original target.
4. UI patcher + hook injector apply runtime modifications.
5. Uninstall restores from backup manifest.
6. Doctor validates runtime/backup/signature state and suggests or applies fixes.
