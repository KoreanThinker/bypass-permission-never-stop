#!/usr/bin/env node
import { Command } from "commander";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, realpathSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Orchestrator } from "./index.js";
import { findClaudeCodeTarget } from "./finder/target-finder.js";
import { runDoctorFlow } from "./doctor/doctor.js";
import { Logger } from "./utils/logger.js";
import { SessionLogger } from "./utils/session-logger.js";

const NEVER_STOP_DIR = join(homedir(), ".claude-never-stop");

export function getDefaultPaths() {
  return {
    backupDir: join(NEVER_STOP_DIR, "backups"),
    logDir: join(NEVER_STOP_DIR, "logs"),
  };
}

export function getCliVersion(): string {
  try {
    const packageJsonPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      version?: unknown;
    };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // fall through to safe default
  }
  return "0.0.0";
}

export type CliBuildOptions = {
  confirmInstall?: () => Promise<boolean>;
  confirmDoctorFix?: () => Promise<boolean>;
};

type PromptIO = {
  question: (query: string) => Promise<string>;
  close: () => void;
};

type PromptFactory = (streams: {
  input: NodeJS.ReadStream;
  output: NodeJS.WriteStream;
}) => PromptIO;

export async function confirmInstallPrompt(promptFactory?: PromptFactory): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const rl = (promptFactory ?? createInterface)({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = (
        await rl.question("ARE YOU SURE INSTALL bypass permission never stop mode? (yes/no): ")
      )
        .trim()
        .toLowerCase();

      if (answer === "yes" || answer === "y") return true;
      if (answer === "no" || answer === "n" || answer === "") return false;
      process.stdout.write("Please type yes or no.\n");
    }
  } finally {
    rl.close();
  }
}

export async function confirmDoctorFixPrompt(
  promptFactory?: PromptFactory
): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const rl = (promptFactory ?? createInterface)({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = (await rl.question("Run doctor fixes now? (yes/no): "))
        .trim()
        .toLowerCase();

      if (answer === "yes" || answer === "y") return true;
      if (answer === "no" || answer === "n" || answer === "") return false;
      process.stdout.write("Please type yes or no.\n");
    }
  } finally {
    rl.close();
  }
}

export function buildCli(signaturesDir?: string, options?: CliBuildOptions): Command {
  const program = new Command();
  const logger = new Logger();
  const confirmInstall = options?.confirmInstall ?? confirmInstallPrompt;
  const confirmDoctorFix = options?.confirmDoctorFix ?? confirmDoctorFixPrompt;

  const defaultSigDir = signaturesDir ?? join(__dirname, "..", "signatures");
  const paths = getDefaultPaths();

  const runInstallFlow = async (
    mode: "install" | "upgrade",
    skipPrompt: boolean
  ): Promise<void> => {
    const modeLabel = mode === "install" ? "Install" : "Upgrade";
    const modeAction = mode === "install" ? "INSTALL" : "UPGRADE";
    logger.info(`Starting ${mode} flow...`);

    const sessionLogger = new SessionLogger(paths.logDir);
    sessionLogger.log(`${modeLabel} started`, modeAction);

    if (!skipPrompt) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        logger.warn(
          `Non-interactive shell detected. Re-run with --yes to ${mode}.`
        );
        sessionLogger.log(
          `${modeLabel} aborted: non-interactive shell without --yes`,
          modeAction
        );
        process.exit(1);
      }

      const confirmed = await confirmInstall();
      if (!confirmed) {
        logger.warn(`${modeLabel} cancelled. No files were changed.`);
        sessionLogger.log(`${modeLabel} cancelled by user`, modeAction);
        return;
      }
    }

    const orch = new Orchestrator({
      signaturesDir: defaultSigDir,
      backupDir: paths.backupDir,
      logDir: paths.logDir,
    });

    if (mode === "install") {
      if (orch.isPatched()) {
        logger.warn("Already patched. Run 'uninstall' first to re-patch.");
        sessionLogger.log("Already patched, aborting", "INSTALL");
        process.exit(1);
      }
    } else if (orch.isPatched()) {
      logger.info("Existing patch detected. Restoring original binary first...");
      const uninstallResult = orch.uninstall();
      if (!uninstallResult.success) {
        logger.error(`Upgrade failed during restore: ${uninstallResult.error}`);
        sessionLogger.log(
          `Upgrade restore failed: ${uninstallResult.error}`,
          "UPGRADE"
        );
        process.exit(1);
      }
    }

    // Find Claude Code
    logger.info("Scanning for Claude Code installation...");
    const target = await findClaudeCodeTarget();
    if (!target) {
      logger.error("Claude Code not found on this system.");
      logger.error("Make sure Claude Code is installed and accessible.");
      sessionLogger.log("Claude Code not found", modeAction);
      process.exit(1);
    }

    logger.success(`Found: ${target.path}`);
    logger.info(`Type: ${target.type} | Version: ${target.version ?? "unknown"}`);
    sessionLogger.log(
      `Found target: ${target.path} (${target.type}, v${target.version})`,
      modeAction
    );

    if (target.type === "binary") {
      logger.error(
        "Native executable target detected. Binary patching is disabled for safety."
      );
      logger.info(
        "Run 'bypass-permission-never-stop uninstall' if you previously patched this binary."
      );
      logger.info(
        "Use a JavaScript Claude CLI target (for example npm global install) to patch safely."
      );
      sessionLogger.log("Native executable target blocked for safety", modeAction);
      process.exit(1);
    }

    logger.info("Backing up original binary...");
    logger.info("Patching mode cycle array...");
    logger.info("Injecting bypass permission never stop hook...");

    const result = orch.install(target.path, target.version);

    if (result.success) {
      const verb = mode === "install" ? "PATCH" : "UPGRADE";
      logger.success(
        `${verb} COMPLETE: bypass permission never stop READY (${result.patchedCount} patches).`
      );
      logger.success(
        "Run 'claude' -> press Shift+Tab -> select 'bypass permission never stop'."
      );
      sessionLogger.log(
        `${modeLabel} successful: ${result.patchedCount} patches applied`,
        modeAction
      );
    } else {
      logger.error(`${modeLabel} failed: ${result.error}`);

      const supported = orch.getSupportedVersions();
      if (supported.length > 0) {
        logger.info(`Supported versions: ${supported.join(", ")}`);
      }

      sessionLogger.log(`${modeLabel} failed: ${result.error}`, modeAction);
      process.exit(1);
    }
  };

  program
    .name("bypass-permission-never-stop")
    .description("Install bypass permission never stop mode for Claude Code")
    .version(getCliVersion());

  program.option("-y, --yes", "Skip install confirmation prompt");

  // Default action: install
  program.action(async () => {
    logger.banner();
    logger.costWarning();

    const cliOptions = program.opts<{ yes?: boolean }>();
    await runInstallFlow("install", !!cliOptions.yes);
  });

  // Uninstall command
  program
    .command("uninstall")
    .description("Restore the original Claude Code binary")
    .action(() => {
      logger.banner();
      logger.info("Starting uninstall flow...");

      const paths = getDefaultPaths();
      const sessionLogger = new SessionLogger(paths.logDir);
      sessionLogger.log("Uninstall started", "UNINSTALL");

      const orch = new Orchestrator({
        signaturesDir: defaultSigDir,
        backupDir: paths.backupDir,
        logDir: paths.logDir,
      });

      logger.info("Restoring original binary...");
      const result = orch.uninstall();

      if (result.success) {
        logger.success("Original binary restored successfully.");
        sessionLogger.log("Uninstall successful", "UNINSTALL");
      } else {
        logger.error(`Uninstall failed: ${result.error}`);
        sessionLogger.log(`Uninstall failed: ${result.error}`, "UNINSTALL");
        process.exit(1);
      }
    });

  // Upgrade command
  program
    .command("upgrade")
    .alias("update")
    .description("Re-apply latest patch (restore + install)")
    .option("-y, --yes", "Skip install confirmation prompt")
    .action(async function (this: Command, cmdOptions?: { yes?: boolean }) {
      logger.banner();
      logger.costWarning();
      const localOpts = this.opts<{ yes?: boolean }>();
      const globalOpts = program.opts<{ yes?: boolean }>();
      const skipPrompt = !!(
        cmdOptions?.yes ?? localOpts.yes ?? globalOpts.yes
      );
      await runInstallFlow("upgrade", skipPrompt);
    });

  // Doctor command
  program
    .command("doctor")
    .description("Diagnose runtime state and apply guided auto-fixes")
    .action(async () => {
      logger.banner();
      logger.info("Starting doctor flow...");

      const sessionLogger = new SessionLogger(paths.logDir);
      sessionLogger.log("Doctor started", "DOCTOR");

      try {
        const result = await runDoctorFlow({
          signaturesDir: defaultSigDir,
          backupDir: paths.backupDir,
          logDir: paths.logDir,
          interactive: !!(process.stdin.isTTY && process.stdout.isTTY),
          logger,
          confirmDangerous: confirmDoctorFix,
        });

        sessionLogger.log(
          `Doctor completed (pass=${result.finalReport.summary.pass}, warn=${result.finalReport.summary.warn}, fail=${result.finalReport.summary.fail})`,
          "DOCTOR"
        );

        if (result.finalReport.summary.fail > 0) {
          sessionLogger.log("Doctor finished with unresolved failures", "DOCTOR");
          process.exit(1);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Doctor failed: ${message}`);
        sessionLogger.log(`Doctor failed: ${message}`, "DOCTOR");
        process.exit(1);
      }
    });

  return program;
}

// Only run when executed directly (not imported in tests)
function isDirectExecution(): boolean {
  if (typeof process === "undefined" || !process.argv[1]) return false;
  try {
    // Resolve symlinks so npm/yarn/pnpm .bin launchers are detected.
    const executedPath = realpathSync(process.argv[1]);
    const modulePath = realpathSync(__filename);
    return executedPath === modulePath;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  const program = buildCli();
  program.parse();
}
