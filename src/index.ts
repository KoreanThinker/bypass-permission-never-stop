import { readFileSync } from "node:fs";
import { BackupManager } from "./backup/backup-manager.js";
import { UiPatcher } from "./patcher/ui-patcher.js";
import { HookInjector } from "./patcher/hook-injector.js";
import {
  VersionCompatibility,
  type PatchSignature,
} from "./version/compatibility.js";

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

    // Create backup before patching
    this.backup.createBackup(targetPath, version ?? undefined);

    // Build complete patch set (UI patches + hook patches)
    const allPatches = this.hookInjector.buildAllPatches(signature.patches);

    // Apply patches
    const result = this.patcher.patchFile(targetPath, allPatches);

    if (result.appliedCount === 0) {
      // Restore backup since no patches were applied
      try {
        this.backup.restore();
      } catch {
        // Best effort restore
      }
      return {
        success: false,
        error: "No patches could be applied to the target file.",
      };
    }

    return {
      success: result.success || result.appliedCount > 0,
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
