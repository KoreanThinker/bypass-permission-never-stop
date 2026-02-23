import { createFixActions } from "./fixes.js";
import { collectDoctorReport } from "./report.js";
import type {
  DoctorCheckResult,
  DoctorFlowOptions,
  DoctorFlowResult,
  DoctorLogger,
  DoctorReport,
  DoctorStatus,
} from "./types.js";

export type {
  DoctorCheckResult,
  DoctorFlowOptions,
  DoctorFlowResult,
  DoctorLogger,
  DoctorReport,
  DoctorSnapshot,
  DoctorStatus,
} from "./types.js";
export { collectDoctorReport } from "./report.js";

function formatStatus(status: DoctorStatus): string {
  switch (status) {
    case "pass":
      return "PASS";
    case "warn":
      return "WARN";
    case "fail":
      return "FAIL";
  }
}

function printCheck(logger: DoctorLogger, check: DoctorCheckResult): void {
  const line = `[${formatStatus(check.status)}] ${check.title}: ${check.details}`;
  if (check.status === "pass") {
    logger.success(line);
    return;
  }
  if (check.status === "warn") {
    logger.warn(line);
    return;
  }
  logger.error(line);
}

function printReport(logger: DoctorLogger, title: string, report: DoctorReport): void {
  logger.info(title);
  for (const check of report.checks) {
    printCheck(logger, check);
  }

  logger.info(
    `doctor summary: PASS ${report.summary.pass} | WARN ${report.summary.warn} | FAIL ${report.summary.fail}`
  );

  if (report.suggestedCommands.length > 0) {
    logger.info("doctor next commands:");
    for (const command of report.suggestedCommands) {
      logger.info(`- ${command}`);
    }
  }
}

export async function runDoctorFlow(options: DoctorFlowOptions): Promise<DoctorFlowResult> {
  const initialReport = await collectDoctorReport(options);
  printReport(options.logger, "Doctor: initial diagnosis", initialReport);

  const fixActions = createFixActions(options, initialReport);
  const plannedFixes = fixActions.map((action) => action.title);
  const executedFixes: string[] = [];

  if (fixActions.length === 0) {
    options.logger.info("doctor fix: no automatic fixes required.");
    return {
      initialReport,
      finalReport: initialReport,
      plannedFixes,
      executedFixes,
    };
  }

  options.logger.warn(
    `doctor fix: ${fixActions.length} automatic fix step(s) are available.`
  );
  for (const action of fixActions) {
    options.logger.warn(`- ${action.title}`);
  }

  if (!options.interactive) {
    options.logger.warn(
      "doctor fix skipped: non-interactive shell. Re-run in an interactive terminal to apply fixes."
    );
    return {
      initialReport,
      finalReport: initialReport,
      plannedFixes,
      executedFixes,
    };
  }

  const confirmed = options.confirmDangerous
    ? await options.confirmDangerous()
    : false;
  if (!confirmed) {
    options.logger.warn("doctor fix cancelled by user.");
    return {
      initialReport,
      finalReport: initialReport,
      plannedFixes,
      executedFixes,
    };
  }

  for (const action of fixActions) {
    options.logger.info(`doctor fix running: ${action.title}`);
    const result = await action.run();
    if (result.success) {
      options.logger.success(`doctor fix success: ${result.message}`);
      executedFixes.push(action.id);
    } else {
      options.logger.error(`doctor fix failed: ${result.message}`);
    }
  }

  const finalReport = await collectDoctorReport(options);
  printReport(options.logger, "Doctor: post-fix diagnosis", finalReport);

  return {
    initialReport,
    finalReport,
    plannedFixes,
    executedFixes,
  };
}
