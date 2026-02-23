import type { ClaudeCodeTarget } from "../finder/target-finder.js";
import type { PatchSignature, ValidationResult } from "../version/compatibility.js";

export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorCheckResult {
  id: string;
  title: string;
  status: DoctorStatus;
  details: string;
  fixable?: boolean;
}

export interface DoctorSummary {
  pass: number;
  warn: number;
  fail: number;
}

export interface DoctorSnapshot {
  target: ClaudeCodeTarget | null;
  signature: PatchSignature | null;
  validation: ValidationResult | null;
  backupManifestPresent: boolean;
  backupIntegrity: boolean;
  runtimeUiPatched: boolean;
  runtimeHookPatched: boolean;
  runtimeFullyPatched: boolean;
  canInstall: boolean;
  whichClaudePath: string | null;
  pnpmRoot: string | null;
  npmRoot: string | null;
  yarnGlobalDir: string | null;
}

export interface DoctorReport {
  checks: DoctorCheckResult[];
  summary: DoctorSummary;
  suggestedCommands: string[];
  snapshot: DoctorSnapshot;
}

export interface DoctorLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
}

export interface DoctorFlowOptions {
  signaturesDir: string;
  backupDir: string;
  logDir: string;
  interactive: boolean;
  logger: DoctorLogger;
  confirmDangerous?: () => Promise<boolean>;
  findTarget?: () => Promise<ClaudeCodeTarget | null>;
  runCommand?: (command: string) => string | null;
}

export interface DoctorFlowResult {
  initialReport: DoctorReport;
  finalReport: DoctorReport;
  plannedFixes: string[];
  executedFixes: string[];
}

export interface DoctorFixAction {
  id: string;
  title: string;
  run: () => Promise<{ success: boolean; message: string }>;
}
