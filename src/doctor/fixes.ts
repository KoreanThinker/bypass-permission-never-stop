import { existsSync, unlinkSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { BackupManager } from "../backup/backup-manager.js";
import { Orchestrator } from "../index.js";
import type { DoctorFixAction, DoctorFlowOptions, DoctorReport } from "./types.js";

function checkStatus(report: DoctorReport, id: string): "pass" | "warn" | "fail" {
  return report.checks.find((check) => check.id === id)?.status ?? "pass";
}

function safeUnlink(path: string, backupDir: string): boolean {
  try {
    const resolvedPath = resolve(path);
    const resolvedBackupDir = resolve(backupDir);
    const rel = relative(resolvedBackupDir, resolvedPath);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
      return false;
    }
    if (!existsSync(resolvedPath)) return false;
    unlinkSync(resolvedPath);
    return true;
  } catch {
    return false;
  }
}

function shouldAttemptReinstall(report: DoctorReport): boolean {
  const backupIntegrityStatus = checkStatus(report, "backup-integrity");
  const patchStateStatus = checkStatus(report, "patch-state-consistency");

  return (
    report.snapshot.canInstall &&
    !report.snapshot.runtimeFullyPatched &&
    backupIntegrityStatus === "pass" &&
    patchStateStatus === "fail"
  );
}

export function createFixActions(
  options: DoctorFlowOptions,
  report: DoctorReport
): DoctorFixAction[] {
  const actions: DoctorFixAction[] = [];
  const orch = new Orchestrator({
    signaturesDir: options.signaturesDir,
    backupDir: options.backupDir,
    logDir: options.logDir,
  });

  if (report.snapshot.backupManifestPresent && !report.snapshot.backupIntegrity) {
    actions.push({
      id: "cleanup-backup-state",
      title: "Clean corrupted backup manifest/artifacts",
      run: async () => {
        const knownPaths = [
          join(options.backupDir, "manifest.json"),
          join(options.backupDir, "cli.mjs.backup"),
        ];

        let removed = 0;
        for (const path of knownPaths) {
          if (safeUnlink(path, options.backupDir)) {
            removed++;
          }
        }

        return {
          success: true,
          message: `Removed ${removed} corrupted backup artifact(s).`,
        };
      },
    });
  } else if (
    report.snapshot.backupManifestPresent &&
    report.snapshot.backupIntegrity &&
    !report.snapshot.runtimeFullyPatched
  ) {
    actions.push({
      id: "restore-from-backup",
      title: "Restore original runtime from backup (uninstall)",
      run: async () => {
        const result = orch.uninstall();
        if (!result.success) {
          return {
            success: false,
            message: `Restore failed: ${result.error ?? "unknown error"}`,
          };
        }
        return {
          success: true,
          message: "Original runtime restored from backup.",
        };
      },
    });
  }

  if (shouldAttemptReinstall(report)) {
    actions.push({
      id: "reinstall-patch",
      title: "Apply never-stop patch on resolved JS target",
      run: async () => {
        const target = report.snapshot.target;
        if (!target || target.type !== "js") {
          return {
            success: false,
            message: "Install skipped because no JS target is currently resolved.",
          };
        }

        const manager = new BackupManager(options.backupDir);
        if (manager.isPatched()) {
          const restored = orch.uninstall();
          if (!restored.success) {
            return {
              success: false,
              message: `Pre-install restore failed: ${restored.error ?? "unknown error"}`,
            };
          }
        }

        const installed = orch.install(target.path, target.version);
        if (!installed.success) {
          return {
            success: false,
            message: `Install failed: ${installed.error ?? "unknown error"}`,
          };
        }

        return {
          success: true,
          message: `Patch applied successfully (${installed.patchedCount ?? 0} patches).`,
        };
      },
    });
  }

  return actions;
}
