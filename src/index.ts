import { readFileSync } from "node:fs";
import { BackupManager } from "./backup/backup-manager.js";
import { UiPatcher } from "./patcher/ui-patcher.js";
import { HookInjector } from "./patcher/hook-injector.js";
import { VersionCompatibility } from "./version/compatibility.js";

function isNativeExecutable(content: Buffer): boolean {
  if (content.length < 4) return false;

  const be = content.readUInt32BE(0);
  const le = content.readUInt32LE(0);

  // Mach-O (macOS) / Fat binary
  if (
    be === 0xfeedfacf ||
    be === 0xfeedface ||
    be === 0xcafebabe ||
    le === 0xfeedfacf ||
    le === 0xfeedface ||
    le === 0xbebafeca
  ) {
    return true;
  }

  // ELF (Linux)
  if (be === 0x7f454c46) {
    return true;
  }

  // PE/COFF (Windows): "MZ"
  if (content[0] === 0x4d && content[1] === 0x5a) {
    return true;
  }

  return false;
}

export interface OrchestratorConfig {
  signaturesDir: string;
  backupDir: string;
  logDir: string;
}

export interface InstallResult {
  success: boolean;
  error?: string;
  patchedCount?: number;
  version?: string | null;
}

export interface UninstallResult {
  success: boolean;
  error?: string;
}

export class Orchestrator {
  private readonly compat: VersionCompatibility;
  private readonly backup: BackupManager;
  private readonly patcher: UiPatcher;
  private readonly hookInjector: HookInjector;

  constructor(config: OrchestratorConfig) {
    this.compat = new VersionCompatibility(config.signaturesDir);
    this.backup = new BackupManager(config.backupDir);
    this.patcher = new UiPatcher();
    this.hookInjector = new HookInjector();
  }

  install(targetPath: string, version: string | null): InstallResult {
    // Check if already patched
    if (this.backup.isPatched()) {
      return {
        success: false,
        error: "Target is already patched. Run uninstall first.",
      };
    }

    // Find matching signature
    const signature = this.compat.findMatchingSignature(version);
    if (!signature) {
      const supported = this.compat.getSupportedVersions();
      const versionStr = version ?? "unknown";
      return {
        success: false,
        error: `No matching signature found for version ${versionStr}. Supported versions: ${supported.join(", ") || "none"}`,
      };
    }

    // Read target file
    const content = readFileSync(targetPath);

    if (isNativeExecutable(content)) {
      return {
        success: false,
        error:
          "Native executable target detected. Binary patching is disabled for safety because it can corrupt the executable and cause immediate process termination. Run uninstall if needed, then use a JavaScript CLI target.",
      };
    }

    // Check if file is already patched (patterns already replaced)
    if (this.patcher.isPatched(content, signature.patches)) {
      return {
        success: false,
        error: "Target is already patched. Run uninstall first.",
      };
    }

    // Validate that all search patterns exist in the target
    const validation = this.compat.validatePatches(signature, content);
    if (!validation.valid) {
      return {
        success: false,
        error: `Pattern validation failed. Missing patterns: ${validation.missingPatches.join(", ")}`,
      };
    }

    const allPatches = this.hookInjector.buildAllPatches(
      signature.patches,
      content
    );
    const hasNeverStopHook = allPatches.some((patch) =>
      patch.id.startsWith("bypass-permission-never-stop-hook")
    );
    if (!hasNeverStopHook) {
      return {
        success: false,
        error:
          "No compatible BYPASS PERMISSION NEVER STOP hook pattern found for this Claude CLI build.",
      };
    }

    // Create backup before patching
    this.backup.createBackup(targetPath, version ?? undefined);

    // Apply patches
    const result = this.patcher.patchFile(targetPath, allPatches);

    if (!result.success || result.appliedCount === 0) {
      // Restore backup since no patches were applied
      try {
        this.backup.restore();
      } catch {
        // Best effort restore
      }
      return {
        success: false,
        error:
          result.appliedCount === 0
            ? "No patches could be applied to the target file."
            : `Patch application failed for: ${result.failedPatches.join(", ")}`,
      };
    }

    return {
      success: true,
      patchedCount: result.appliedCount,
      version,
    };
  }

  uninstall(): UninstallResult {
    if (!this.backup.isPatched()) {
      return {
        success: false,
        error: "No backup found. Was the patch ever applied?",
      };
    }

    try {
      this.backup.restore();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Restore failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  getSupportedVersions(): string[] {
    return this.compat.getSupportedVersions();
  }

  isPatched(): boolean {
    return this.backup.isPatched();
  }
}
