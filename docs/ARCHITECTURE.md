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
         - inject BYPASS PERMISSION NEVER STOP loop hook
         - attach circuit-breaker logic
```

## Data Flow

1. CLI detects target path/type/version.
2. Signature matcher selects compatible patch set.
3. Backup manager snapshots original target.
4. UI patcher + hook injector apply runtime modifications.
5. Uninstall restores from backup manifest.
