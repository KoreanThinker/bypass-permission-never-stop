export class Logger {
  info(message: string): void {
    process.stdout.write(`\x1b[36m[*]\x1b[0m ${message}\n`);
  }

  success(message: string): void {
    process.stdout.write(`\x1b[32m[+]\x1b[0m ${message}\n`);
  }

  error(message: string): void {
    process.stderr.write(`\x1b[31m[-]\x1b[0m ${message}\n`);
  }

  warn(message: string): void {
    process.stderr.write(`\x1b[33m[!]\x1b[0m ${message}\n`);
  }

  banner(): void {
    process.stdout.write(
      `\x1b[36m
  ┌──────────────────────────────────────────────────┐
  │ bypass-permission-never-stop                    │
  │ DEMO MODE: BYPASS PERMISSION NEVER STOP          │
  └──────────────────────────────────────────────────┘
\x1b[0m\n`
    );
  }

  costWarning(): void {
    process.stdout.write(
      `\x1b[90m[i]\x1b[0m BYPASS PERMISSION NEVER STOP can consume many tokens. Press Ctrl+C to stop anytime.\n`
    );
  }
}
