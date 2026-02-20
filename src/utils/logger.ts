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
      `\x1b[32m
  ╔══════════════════════════════════════════════════╗
  ║   BYPASS PERMISSION NEVER STOP                  ║
  ║   Claude Code God Mode Injector                 ║
  ╚══════════════════════════════════════════════════╝
\x1b[0m\n`
    );
  }

  costWarning(): void {
    process.stderr.write(
      `\x1b[31m[!] Warning: This mode will consume tokens indefinitely until Ctrl+C.\x1b[0m\n`
    );
  }
}
