#!/usr/bin/env node
import { Command } from "commander";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, realpathSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Orchestrator } from "./index.js";
import { findClaudeCodeTarget } from "./finder/target-finder.js";
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
        await rl.question("ARE YOU SURE INSTALL never-stop mode? (yes/no): ")
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

export function buildCli(signaturesDir?: string, options?: CliBuildOptions): Command {
  const program = new Command();
  const logger = new Logger();
  const confirmInstall = options?.confirmInstall ?? confirmInstallPrompt;

  const defaultSigDir = signaturesDir ?? join(__dirname, "..", "signatures");

  program
    .name("bypass-permission-never-stop")
    .description("Install never-stop mode for Claude Code (unofficial)")
    .version(getCliVersion());

  program.option("-y, --yes", "Skip install confirmation prompt");

  // Default action: install
  program.action(async () => {
    logger.banner();
    logger.costWarning();

    const cliOptions = program.opts<{ yes?: boolean }>();
    logger.info("Starting install flow...");

    const paths = getDefaultPaths();
    const sessionLogger = new SessionLogger(paths.logDir);
    sessionLogger.log("Install started", "INSTALL");

    if (!cliOptions.yes) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        logger.warn("Non-interactive shell detected. Re-run with --yes to install.");
        sessionLogger.log("Install aborted: non-interactive shell without --yes", "INSTALL");
        process.exit(1);
      }

      const confirmed = await confirmInstall();
      if (!confirmed) {
        logger.warn("Install cancelled. No files were changed.");
        sessionLogger.log("Install cancelled by user", "INSTALL");
        return;
      }
    }

    const orch = new Orchestrator({
      signaturesDir: defaultSigDir,
      backupDir: paths.backupDir,
      logDir: paths.logDir,
    });

    // Check if already patched
    if (orch.isPatched()) {
      logger.warn("Already patched. Run 'uninstall' first to re-patch.");
      sessionLogger.log("Already patched, aborting", "INSTALL");
      process.exit(1);
    }

    // Find Claude Code
    logger.info("Scanning for Claude Code installation...");
    const target = await findClaudeCodeTarget();
    if (!target) {
      logger.error("Claude Code not found on this system.");
      logger.error("Make sure Claude Code is installed and accessible.");
      sessionLogger.log("Claude Code not found", "INSTALL");
      process.exit(1);
    }

    logger.success(`Found: ${target.path}`);
    logger.info(`Type: ${target.type} | Version: ${target.version ?? "unknown"}`);
    sessionLogger.log(`Found target: ${target.path} (${target.type}, v${target.version})`, "INSTALL");

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
      sessionLogger.log("Native executable target blocked for safety", "INSTALL");
      process.exit(1);
    }

    // Install
    logger.info("Backing up original binary...");
    logger.info("Patching mode cycle array...");
    logger.info("Injecting never-stop hook...");

    const result = orch.install(target.path, target.version);

    if (result.success) {
      logger.success(`Patch applied successfully (${result.patchedCount} patches).`);
      logger.success("Run 'claude' and hit Shift+Tab to find 'Never Stop' mode.");
      sessionLogger.log(`Patch successful: ${result.patchedCount} patches applied`, "INSTALL");
    } else {
      logger.error(`Patch failed: ${result.error}`);

      const supported = orch.getSupportedVersions();
      if (supported.length > 0) {
        logger.info(`Supported versions: ${supported.join(", ")}`);
      }

      sessionLogger.log(`Patch failed: ${result.error}`, "INSTALL");
      process.exit(1);
    }
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
