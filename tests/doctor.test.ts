import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BackupManager } from "../src/backup/backup-manager.js";
import { HookInjector } from "../src/patcher/hook-injector.js";
import { createFixActions } from "../src/doctor/fixes.js";
import {
  collectDoctorReport,
  runDoctorFlow,
  type DoctorLogger,
  type DoctorReport,
} from "../src/doctor/doctor.js";

function writeSignature(signaturesDir: string): void {
  const signature = {
    versionRange: "2.1.x",
    minVersion: "2.1.0",
    maxVersion: "2.1.99",
    targetType: "binary",
    patches: [
      {
        id: "mode-cycle",
        description: "cycle",
        search: 'case"bypassPermissions":return"default"',
        replace: 'case"bypassPermissions":return"neverStop"',
      },
      {
        id: "mode-default",
        description: "default",
        search: 'case"dontAsk":return"default"}}',
        replace: 'case"dontAsk":return"default";case"neverStop":return"default"}}',
      },
      {
        id: "mode-display",
        description: "display",
        search: 'case"dontAsk":return"Don\'t Ask"}}',
        replace:
          'case"dontAsk":return"Don\'t Ask";case"neverStop":return"bypass permission never stop"}}',
      },
    ],
  };
  writeFileSync(join(signaturesDir, "v2.1.x.json"), JSON.stringify(signature), "utf-8");
}

function writeInstallableTarget(path: string): void {
  writeFileSync(
    path,
    [
      'function VNT(T){switch(T.mode){case"bypassPermissions":return"default";case"dontAsk":return"default"}}',
      'function Qu(T){switch(T){case"dontAsk":return"Don\'t Ask"}}',
      'yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g',
    ].join("\n"),
    "utf-8"
  );
}

function writeUiPatchedOnlyTarget(path: string): void {
  writeFileSync(
    path,
    [
      'function VNT(T){switch(T.mode){case"bypassPermissions":return"neverStop";case"dontAsk":return"default";case"neverStop":return"default"}}',
      'function Qu(T){switch(T){case"dontAsk":return"Don\'t Ask";case"neverStop":return"bypass permission never stop"}}',
    ].join("\n"),
    "utf-8"
  );
}

function writeFullyPatchedTarget(path: string): void {
  const hookReplace = new HookInjector().generateNeverStopPatch().replace;
  writeFileSync(
    path,
    [
      'function VNT(T){switch(T.mode){case"bypassPermissions":return"neverStop";case"dontAsk":return"default";case"neverStop":return"default"}}',
      'function Qu(T){switch(T){case"dontAsk":return"Don\'t Ask";case"neverStop":return"bypass permission never stop"}}',
      hookReplace,
    ].join("\n"),
    "utf-8"
  );
}

function createLogger(): DoctorLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  };
}

describe("Doctor", () => {
  let tempDir: string;
  let signaturesDir: string;
  let backupDir: string;
  let logDir: string;
  let targetPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "doctor-test-"));
    signaturesDir = join(tempDir, "signatures");
    backupDir = join(tempDir, "backups");
    logDir = join(tempDir, "logs");
    targetPath = join(tempDir, "cli.js");
    mkdirSync(signaturesDir);
    mkdirSync(backupDir);
    mkdirSync(logDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("reports healthy installability for supported JS target", async () => {
    writeSignature(signaturesDir);
    writeInstallableTarget(targetPath);

    const report = await collectDoctorReport({
      signaturesDir,
      backupDir,
      findTarget: async () => ({ path: targetPath, type: "js", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? targetPath : null),
    });

    expect(report.summary.fail).toBe(0);
    expect(report.summary.warn).toBe(0);
    expect(report.checks.find((c) => c.id === "installability")?.status).toBe("pass");
  });

  it("fails diagnosis for native binary target", async () => {
    writeSignature(signaturesDir);
    const binaryPath = join(tempDir, "claude-bin");
    writeFileSync(binaryPath, Buffer.from([0xfe, 0xed, 0xfa, 0xcf, 0x00, 0x01]));

    const report = await collectDoctorReport({
      signaturesDir,
      backupDir,
      findTarget: async () => ({ path: binaryPath, type: "binary", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? binaryPath : null),
    });

    expect(report.summary.fail).toBeGreaterThan(0);
    expect(report.checks.find((c) => c.id === "target-type")?.status).toBe("fail");
  });

  it("auto-recovers inconsistent backup state with restore+install", async () => {
    writeSignature(signaturesDir);
    writeInstallableTarget(targetPath);

    // Create manifest-only patched state: backup exists, runtime still unpatched.
    const backup = new BackupManager(backupDir);
    backup.createBackup(targetPath, "2.1.49");

    const logger = createLogger();
    const result = await runDoctorFlow({
      signaturesDir,
      backupDir,
      logDir,
      interactive: true,
      logger,
      confirmDangerous: async () => true,
      findTarget: async () => ({ path: targetPath, type: "js", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? targetPath : null),
    });

    expect(result.plannedFixes.length).toBeGreaterThan(0);
    expect(result.executedFixes).toContain("restore-from-backup");
    expect(result.executedFixes).toContain("reinstall-patch");
    expect(result.finalReport.summary.fail).toBe(0);

    const patched = readFileSync(targetPath, "utf-8");
    expect(patched).toContain('case"bypassPermissions":return"neverStop"');
    expect(patched).toContain("XT.filter");
  });

  it("does not auto-patch a clean unmanaged runtime", async () => {
    writeSignature(signaturesDir);
    writeInstallableTarget(targetPath);

    const logger = createLogger();
    const result = await runDoctorFlow({
      signaturesDir,
      backupDir,
      logDir,
      interactive: true,
      logger,
      confirmDangerous: async () => true,
      findTarget: async () => ({ path: targetPath, type: "js", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? targetPath : null),
    });

    expect(result.initialReport.summary.fail).toBe(0);
    expect(result.initialReport.summary.warn).toBe(0);
    expect(result.plannedFixes).toHaveLength(0);
    expect(result.executedFixes).toHaveLength(0);

    const content = readFileSync(targetPath, "utf-8");
    expect(content).not.toContain('case"bypassPermissions":return"neverStop"');
  });

  it("does not delete files outside backup directory during cleanup", async () => {
    writeSignature(signaturesDir);
    writeInstallableTarget(targetPath);

    const manager = new BackupManager(backupDir);
    manager.createBackup(targetPath, "2.1.49");

    const externalFile = join(tempDir, "do-not-delete.txt");
    writeFileSync(externalFile, "keep", "utf-8");

    const manifestPath = join(backupDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      originalPath: string;
      backupPath: string;
      originalHash: string;
      timestamp: string;
      claudeCodeVersion?: string;
    };

    manifest.backupPath = externalFile;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const logger = createLogger();
    const result = await runDoctorFlow({
      signaturesDir,
      backupDir,
      logDir,
      interactive: true,
      logger,
      confirmDangerous: async () => true,
      findTarget: async () => ({ path: targetPath, type: "js", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? targetPath : null),
    });

    expect(result.executedFixes).toContain("cleanup-backup-state");
    expect(result.executedFixes).not.toContain("reinstall-patch");
    expect(readFileSync(externalFile, "utf-8")).toBe("keep");
    expect(readFileSync(targetPath, "utf-8")).not.toContain(
      'case"bypassPermissions":return"neverStop"'
    );
  });

  it("skips automatic fixes in non-interactive mode", async () => {
    writeSignature(signaturesDir);
    writeInstallableTarget(targetPath);
    const backup = new BackupManager(backupDir);
    backup.createBackup(targetPath, "2.1.49");

    const confirmDangerous = vi.fn(async () => true);
    const logger = createLogger();
    const result = await runDoctorFlow({
      signaturesDir,
      backupDir,
      logDir,
      interactive: false,
      logger,
      confirmDangerous,
      findTarget: async () => ({ path: targetPath, type: "js", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? targetPath : null),
    });

    expect(result.plannedFixes.length).toBeGreaterThan(0);
    expect(result.executedFixes).toHaveLength(0);
    expect(confirmDangerous).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("non-interactive shell")
    );
  });

  it("cancels automatic fixes when user does not confirm", async () => {
    writeSignature(signaturesDir);
    writeInstallableTarget(targetPath);
    const backup = new BackupManager(backupDir);
    backup.createBackup(targetPath, "2.1.49");

    const logger = createLogger();
    const result = await runDoctorFlow({
      signaturesDir,
      backupDir,
      logDir,
      interactive: true,
      logger,
      confirmDangerous: async () => false,
      findTarget: async () => ({ path: targetPath, type: "js", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? targetPath : null),
    });

    expect(result.plannedFixes.length).toBeGreaterThan(0);
    expect(result.executedFixes).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("cancelled by user"));
  });

  it("reports failed action when reinstall becomes impossible mid-run", async () => {
    writeSignature(signaturesDir);
    writeInstallableTarget(targetPath);
    const backup = new BackupManager(backupDir);
    backup.createBackup(targetPath, "2.1.49");

    const logger = createLogger();
    const result = await runDoctorFlow({
      signaturesDir,
      backupDir,
      logDir,
      interactive: true,
      logger,
      confirmDangerous: async () => {
        unlinkSync(join(backupDir, "manifest.json"));
        writeFullyPatchedTarget(targetPath);
        return true;
      },
      findTarget: async () => ({ path: targetPath, type: "js", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? targetPath : null),
    });

    expect(result.executedFixes).toHaveLength(0);
    expect(result.plannedFixes).toContain("Apply never-stop patch on resolved JS target");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("doctor fix failed:")
    );
  });

  it("reports failures and suggestions when target discovery fails", async () => {
    const report = await collectDoctorReport({
      signaturesDir,
      backupDir,
      findTarget: async () => null,
      runCommand: () => null,
    });

    expect(report.checks.find((c) => c.id === "target-discovery")?.status).toBe("fail");
    expect(report.checks.find((c) => c.id === "environment-hints")?.status).toBe("warn");
    expect(report.suggestedCommands).toContain("which claude");
    expect(report.suggestedCommands).toContain("claude --version");
    expect(report.suggestedCommands).toContain(
      "npx -y bypass-permission-never-stop@latest upgrade"
    );
    expect(report.suggestedCommands).not.toContain(
      "npx -y bypass-permission-never-stop@latest doctor"
    );
  });

  it("warns on mixed-target shell path and suggests upgrade on signature mismatch", async () => {
    writeInstallableTarget(targetPath);

    const report = await collectDoctorReport({
      signaturesDir,
      backupDir,
      findTarget: async () => ({ path: targetPath, type: "js", version: "9.9.9" }),
      runCommand: (cmd) => {
        if (cmd === "which claude") return "/tmp/.local/share/claude/versions/2.1.50/claude";
        if (cmd === "pnpm root -g") return "/tmp/pnpm-global";
        if (cmd === "npm root -g") return "/tmp/npm-global";
        if (cmd === "yarn global dir") return "/tmp/yarn-global";
        return null;
      },
    });

    expect(report.checks.find((c) => c.id === "environment-hints")?.status).toBe("warn");
    expect(report.checks.find((c) => c.id === "signature-match")?.status).toBe("fail");
    expect(report.suggestedCommands).toContain("claude --version");
    expect(report.suggestedCommands).toContain(
      "npx -y bypass-permission-never-stop@latest upgrade"
    );
  });

  it("flags partial patch markers as inconsistent runtime state", async () => {
    writeSignature(signaturesDir);
    writeUiPatchedOnlyTarget(targetPath);

    const report = await collectDoctorReport({
      signaturesDir,
      backupDir,
      findTarget: async () => ({ path: targetPath, type: "js", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? targetPath : null),
    });

    expect(report.checks.find((c) => c.id === "hook-compatibility")?.status).toBe("fail");
    expect(report.checks.find((c) => c.id === "patch-state-consistency")?.status).toBe("fail");
    expect(report.checks.find((c) => c.id === "installability")?.status).toBe("fail");
    expect(report.suggestedCommands).toContain(
      "npx -y bypass-permission-never-stop@latest doctor"
    );
  });

  it("warns when runtime is patched but backup manifest is missing", async () => {
    writeSignature(signaturesDir);
    writeFullyPatchedTarget(targetPath);

    const report = await collectDoctorReport({
      signaturesDir,
      backupDir,
      findTarget: async () => ({ path: targetPath, type: "js", version: "2.1.49" }),
      runCommand: (cmd) => (cmd === "which claude" ? targetPath : null),
    });

    expect(report.checks.find((c) => c.id === "pattern-validation")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "hook-compatibility")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "patch-state-consistency")?.status).toBe("warn");
    expect(report.checks.find((c) => c.id === "installability")?.status).toBe("pass");
  });

  it("guards reinstall action when no JS target can be resolved", async () => {
    writeSignature(signaturesDir);

    const report: DoctorReport = {
      checks: [
        {
          id: "backup-integrity",
          title: "Backup manifest integrity",
          status: "pass",
          details: "ok",
        },
        {
          id: "patch-state-consistency",
          title: "Patched state consistency",
          status: "fail",
          details: "inconsistent",
        },
      ],
      summary: { pass: 1, warn: 0, fail: 1 },
      suggestedCommands: [],
      snapshot: {
        target: null,
        signature: null,
        validation: null,
        backupManifestPresent: false,
        backupIntegrity: true,
        runtimeUiPatched: false,
        runtimeHookPatched: false,
        runtimeFullyPatched: false,
        canInstall: true,
        whichClaudePath: null,
        pnpmRoot: null,
        npmRoot: null,
        yarnGlobalDir: null,
      },
    };

    const actions = createFixActions(
      {
        signaturesDir,
        backupDir,
        logDir,
        interactive: true,
        logger: createLogger(),
      },
      report
    );

    const reinstall = actions.find((action) => action.id === "reinstall-patch");
    expect(reinstall).toBeDefined();
    const result = await reinstall!.run();
    expect(result.success).toBe(false);
    expect(result.message).toContain("no JS target");
  });
});
