import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { BackupManager } from "../backup/backup-manager.js";
import { findClaudeCodeTarget } from "../finder/target-finder.js";
import { HookInjector } from "../patcher/hook-injector.js";
import { UiPatcher } from "../patcher/ui-patcher.js";
import { VersionCompatibility } from "../version/compatibility.js";
import type {
  DoctorCheckResult,
  DoctorFlowOptions,
  DoctorReport,
  DoctorSnapshot,
  DoctorSummary,
} from "./types.js";

function defaultRunCommand(command: string): string | null {
  try {
    const value = execSync(command, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function dedupeCommands(commands: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const command of commands) {
    if (seen.has(command)) continue;
    seen.add(command);
    result.push(command);
  }
  return result;
}

function countSummary(checks: DoctorCheckResult[]): DoctorSummary {
  return checks.reduce<DoctorSummary>(
    (acc, check) => {
      acc[check.status]++;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );
}

function computeSuggestedCommands(
  checks: DoctorCheckResult[],
  snapshot: DoctorSnapshot
): string[] {
  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");
  if (!hasFail && !hasWarn) {
    return [];
  }

  const commands: string[] = [];

  if (!snapshot.target) {
    commands.push("which claude");
  }

  if (snapshot.target?.type === "binary") {
    commands.push("npx bypass-permission-never-stop uninstall");
    commands.push("pnpm add -g @anthropic-ai/claude-code");
  }

  if (
    !snapshot.signature ||
    (!snapshot.runtimeUiPatched && snapshot.validation && !snapshot.validation.valid)
  ) {
    commands.push("claude --version");
    commands.push("npx -y bypass-permission-never-stop@latest upgrade");
  }

  if (!snapshot.runtimeHookPatched && !snapshot.canInstall) {
    commands.push("npx -y bypass-permission-never-stop@latest doctor");
  }

  if (snapshot.backupManifestPresent && !snapshot.backupIntegrity) {
    commands.push("npx bypass-permission-never-stop uninstall");
  }

  if (hasFail) {
    commands.push("npx -y bypass-permission-never-stop@latest doctor");
  }

  return dedupeCommands(commands).slice(0, 3);
}

function buildCheckResults(
  snapshot: DoctorSnapshot,
  hookPatchCandidateExists: boolean
): DoctorCheckResult[] {
  const checks: DoctorCheckResult[] = [];
  const target = snapshot.target;
  const signature = snapshot.signature;
  const validation = snapshot.validation;

  const addCheck = (check: DoctorCheckResult): void => {
    checks.push(check);
  };

  addCheck(
    target
      ? {
          id: "target-discovery",
          title: "Claude target discovery",
          status: "pass",
          details: `Resolved target: ${target.path}`,
        }
      : {
          id: "target-discovery",
          title: "Claude target discovery",
          status: "fail",
          details: "Unable to locate Claude Code runtime target.",
        }
  );

  addCheck(
    !target
      ? {
          id: "target-type",
          title: "Target type safety",
          status: "fail",
          details: "Target type could not be determined because target discovery failed.",
        }
      : target.type === "js"
        ? {
            id: "target-type",
            title: "Target type safety",
            status: "pass",
            details: "Target is JavaScript runtime and is patch-safe.",
          }
        : {
            id: "target-type",
            title: "Target type safety",
            status: "fail",
            details:
              "Target is native binary. Runtime patching is intentionally blocked for safety.",
          }
  );

  addCheck(
    !target
      ? {
          id: "version-visibility",
          title: "Version visibility",
          status: "fail",
          details: "Target version is unavailable because target discovery failed.",
        }
      : target.version
        ? {
            id: "version-visibility",
            title: "Version visibility",
            status: "pass",
            details: `Resolved Claude version: ${target.version}`,
          }
        : {
            id: "version-visibility",
            title: "Version visibility",
            status: "warn",
            details: "Target found but version is unknown.",
          }
  );

  addCheck(
    !target
      ? {
          id: "signature-match",
          title: "Signature match",
          status: "fail",
          details: "Cannot match signature without target metadata.",
        }
      : signature
        ? {
            id: "signature-match",
            title: "Signature match",
            status: "pass",
            details: `Matched signature range: ${signature.versionRange}`,
          }
        : {
            id: "signature-match",
            title: "Signature match",
            status: "fail",
            details: `No compatible signature found for version ${target.version ?? "unknown"}.`,
          }
  );

  addCheck(
    !target || target.type !== "js" || !signature
      ? {
          id: "pattern-validation",
          title: "Patch pattern validation",
          status: "fail",
          details: "Cannot validate patch patterns for current target state.",
        }
      : snapshot.runtimeUiPatched
        ? {
            id: "pattern-validation",
            title: "Patch pattern validation",
            status: "pass",
            details: "UI patch markers are already present.",
          }
        : validation?.valid
          ? {
              id: "pattern-validation",
              title: "Patch pattern validation",
              status: "pass",
              details: "All required patch search patterns are present.",
            }
          : {
              id: "pattern-validation",
              title: "Patch pattern validation",
              status: "fail",
              details: `Missing patterns: ${validation?.missingPatches.join(", ") ?? "unknown"}.`,
            }
  );

  addCheck(
    !target || target.type !== "js"
      ? {
          id: "hook-compatibility",
          title: "Hook compatibility precheck",
          status: "fail",
          details: "Cannot validate hook compatibility for current target state.",
        }
      : snapshot.runtimeHookPatched
        ? {
            id: "hook-compatibility",
            title: "Hook compatibility precheck",
            status: "pass",
            details: "Never-stop hook marker already present.",
          }
        : hookPatchCandidateExists
          ? {
              id: "hook-compatibility",
              title: "Hook compatibility precheck",
              status: "pass",
              details: "Compatible hook patch pattern found.",
            }
          : {
              id: "hook-compatibility",
              title: "Hook compatibility precheck",
              status: "fail",
              details: "No compatible hook patch pattern found for current runtime shape.",
            }
  );

  addCheck(
    !snapshot.backupManifestPresent
      ? {
          id: "backup-integrity",
          title: "Backup manifest integrity",
          status: "pass",
          details: "No backup manifest present.",
        }
      : snapshot.backupIntegrity
        ? {
            id: "backup-integrity",
            title: "Backup manifest integrity",
            status: "pass",
            details: "Backup manifest and hash integrity are valid.",
          }
        : {
            id: "backup-integrity",
            title: "Backup manifest integrity",
            status: "fail",
            details: "Backup manifest exists but backup file/hash integrity is invalid.",
            fixable: true,
          }
  );

  addCheck(
    snapshot.backupManifestPresent && snapshot.backupIntegrity && snapshot.runtimeFullyPatched
      ? {
          id: "patch-state-consistency",
          title: "Patched state consistency",
          status: "pass",
          details: "Backup state and runtime patch markers are consistent.",
        }
      : snapshot.backupManifestPresent && !snapshot.runtimeFullyPatched
        ? {
            id: "patch-state-consistency",
            title: "Patched state consistency",
            status: "fail",
            details:
              "Backup says patched but runtime markers are missing or partial. Restore + reinstall is recommended.",
            fixable: true,
          }
        : !snapshot.backupManifestPresent &&
            !snapshot.runtimeUiPatched &&
            !snapshot.runtimeHookPatched
          ? {
              id: "patch-state-consistency",
              title: "Patched state consistency",
              status: "pass",
              details: "Runtime is clean and unmanaged (no patch markers, no backup manifest).",
            }
          : !snapshot.backupManifestPresent && snapshot.runtimeFullyPatched
            ? {
                id: "patch-state-consistency",
                title: "Patched state consistency",
                status: "warn",
                details:
                  "Runtime appears patched but backup manifest is missing. Uninstall safety is reduced.",
              }
            : {
                id: "patch-state-consistency",
                title: "Patched state consistency",
                status: "fail",
                details:
                  "Partial patch markers detected. Runtime may be in inconsistent state.",
              }
  );

  addCheck(
    !target
      ? {
          id: "installability",
          title: "Installability simulation",
          status: "fail",
          details: "Installability cannot be evaluated because target discovery failed.",
        }
      : target.type !== "js"
        ? {
            id: "installability",
            title: "Installability simulation",
            status: "fail",
            details: "Native binary target is not installable by design.",
          }
        : !signature
          ? {
              id: "installability",
              title: "Installability simulation",
              status: "fail",
              details: "No signature available for this runtime version.",
            }
          : snapshot.runtimeFullyPatched
            ? {
                id: "installability",
                title: "Installability simulation",
                status: "pass",
                details: "Runtime already has complete never-stop patch markers.",
              }
            : !validation?.valid
              ? {
                  id: "installability",
                  title: "Installability simulation",
                  status: "fail",
                  details: `Install would fail due to missing patterns: ${validation?.missingPatches.join(", ") ?? "unknown"}.`,
                }
              : !hookPatchCandidateExists && !snapshot.runtimeHookPatched
                ? {
                    id: "installability",
                    title: "Installability simulation",
                    status: "fail",
                    details: "Install would fail because no compatible hook patch is available.",
                  }
                : {
                    id: "installability",
                    title: "Installability simulation",
                    status: "pass",
                    details: "Runtime is installable with current signatures and hook patterns.",
                  }
  );

  const hintParts: string[] = [];
  if (snapshot.whichClaudePath) hintParts.push(`which claude=${snapshot.whichClaudePath}`);
  if (snapshot.pnpmRoot) hintParts.push(`pnpm root -g=${snapshot.pnpmRoot}`);
  if (snapshot.npmRoot) hintParts.push(`npm root -g=${snapshot.npmRoot}`);
  if (snapshot.yarnGlobalDir) hintParts.push(`yarn global dir=${snapshot.yarnGlobalDir}`);
  const hintText = hintParts.join(" | ");

  addCheck(
    !snapshot.whichClaudePath
      ? {
          id: "environment-hints",
          title: "Environment toolchain hints",
          status: "warn",
          details: "Unable to resolve `which claude` from current shell environment.",
        }
      : target &&
          snapshot.whichClaudePath !== target.path &&
          snapshot.whichClaudePath.includes(".local/share/claude/versions") &&
          target.type === "js"
        ? {
            id: "environment-hints",
            title: "Environment toolchain hints",
            status: "warn",
            details: `Mixed-target setup detected. which points to native binary, but patch target is JS runtime. ${hintText}`.trim(),
          }
        : {
            id: "environment-hints",
            title: "Environment toolchain hints",
            status: "pass",
            details: hintText || "Basic toolchain checks completed.",
          }
  );

  return checks;
}

export async function collectDoctorReport(
  options: Pick<
    DoctorFlowOptions,
    "signaturesDir" | "backupDir" | "findTarget" | "runCommand"
  >
): Promise<DoctorReport> {
  const compat = new VersionCompatibility(options.signaturesDir);
  const backup = new BackupManager(options.backupDir);
  const patcher = new UiPatcher();
  const hookInjector = new HookInjector();
  const runCommand = options.runCommand ?? defaultRunCommand;
  const findTarget = options.findTarget ?? findClaudeCodeTarget;

  const target = await findTarget();
  const whichClaudePath = runCommand("which claude");
  const pnpmRoot = runCommand("pnpm root -g");
  const npmRoot = runCommand("npm root -g");
  const yarnGlobalDir = runCommand("yarn global dir");

  const backupManifestPresent = backup.getManifest() !== null;
  const backupIntegrity = backupManifestPresent ? backup.verifyIntegrity() : true;

  let targetContent: Buffer | null = null;
  if (target?.type === "js" && existsSync(target.path)) {
    targetContent = readFileSync(target.path);
  }

  const signature = target ? compat.findMatchingSignature(target.version) : null;
  const validation =
    signature && targetContent ? compat.validatePatches(signature, targetContent) : null;

  const targetText = targetContent?.toString("utf-8") ?? "";
  const runtimeHookPatched =
    targetText.length > 0 &&
    hookInjector
      .getNeverStopPatches()
      .some((patch) => targetText.includes(patch.replace));
  const runtimeUiPatched =
    !!(signature && targetContent && patcher.isPatched(targetContent, signature.patches));
  const runtimeFullyPatched = runtimeUiPatched && runtimeHookPatched;
  const hookPatchCandidateExists =
    targetContent !== null && hookInjector.findCompatibleHookPatch(targetContent) !== null;

  const canInstall =
    target?.type === "js" &&
    !!signature &&
    !!targetContent &&
    ((validation?.valid ?? false) || runtimeUiPatched) &&
    (runtimeHookPatched || hookPatchCandidateExists);

  const snapshot: DoctorSnapshot = {
    target,
    signature,
    validation,
    backupManifestPresent,
    backupIntegrity,
    runtimeUiPatched,
    runtimeHookPatched,
    runtimeFullyPatched,
    canInstall,
    whichClaudePath,
    pnpmRoot,
    npmRoot,
    yarnGlobalDir,
  };

  const checks = buildCheckResults(snapshot, hookPatchCandidateExists);
  return {
    checks,
    summary: countSummary(checks),
    suggestedCommands: computeSuggestedCommands(checks, snapshot),
    snapshot,
  };
}
