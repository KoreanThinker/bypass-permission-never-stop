import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export class SessionLogger {
  private readonly logDir: string;
  private logFile: string | null = null;

  constructor(logDir: string) {
    this.logDir = logDir;
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  log(message: string, action?: string): void {
    if (!this.logFile) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      this.logFile = join(this.logDir, `session-${timestamp}.log`);
    }

    const now = new Date().toISOString();
    const prefix = action ? `[${action}] ` : "";
    const line = `${now} ${prefix}${message}\n`;

    appendFileSync(this.logFile, line, "utf-8");
  }

  getLogPath(): string | null {
    return this.logFile;
  }
}
