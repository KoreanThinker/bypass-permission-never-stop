import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildCli,
  getDefaultPaths,
  getCliVersion,
  confirmInstallPrompt,
} from "../src/cli.js";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("getDefaultPaths", () => {
  it("should return paths under ~/.claude-never-stop", () => {
    const paths = getDefaultPaths();
    expect(paths.backupDir).toContain(".claude-never-stop");
    expect(paths.logDir).toContain(".claude-never-stop");
    expect(paths.backupDir).toContain("backups");
    expect(paths.logDir).toContain("logs");
  });
});

describe("buildCli", () => {
  let tempDir: string;
  let sigDir: string;
  let stdinTTYDescriptor: PropertyDescriptor | undefined;
  let stdoutTTYDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cli-test-"));
    sigDir = join(tempDir, "signatures");
    mkdirSync(sigDir);
    stdinTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    stdoutTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  });

  afterEach(() => {
    if (stdinTTYDescriptor) {
      Object.defineProperty(process.stdin, "isTTY", stdinTTYDescriptor);
    } else {
      delete (process.stdin as { isTTY?: boolean }).isTTY;
    }
    if (stdoutTTYDescriptor) {
      Object.defineProperty(process.stdout, "isTTY", stdoutTTYDescriptor);
    } else {
      delete (process.stdout as { isTTY?: boolean }).isTTY;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create a CLI program with install and uninstall commands", () => {
    const cli = buildCli(sigDir);
    expect(cli).toBeDefined();
    expect(cli.name()).toBe("bypass-permission-never-stop");
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
    expect(cli.version()).toBe(pkg.version);
  });

  it("should have uninstall command", () => {
    const cli = buildCli(sigDir);
    const commands = cli.commands.map((c) => c.name());
    expect(commands).toContain("uninstall");
  });

  it("should resolve CLI version from package.json", () => {
    const version = getCliVersion();
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
    expect(version).toBe(pkg.version);
  });

  it("returns false for confirmation prompt in non-interactive shells", async () => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: false });
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: false });
    const result = await confirmInstallPrompt();
    expect(result).toBe(false);
  });

  it("accepts yes in confirmation prompt", async () => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });

    const close = vi.fn();
    const prompt = vi
      .fn()
      .mockReturnValue({ question: vi.fn().mockResolvedValue("yes"), close });

    const result = await confirmInstallPrompt(prompt);

    expect(result).toBe(true);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("re-prompts on invalid input then accepts y", async () => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const close = vi.fn();
    const question = vi
      .fn()
      .mockResolvedValueOnce("maybe")
      .mockResolvedValueOnce("y");
    const prompt = vi.fn().mockReturnValue({ question, close });

    const result = await confirmInstallPrompt(prompt);

    expect(result).toBe(true);
    expect(question).toHaveBeenCalledTimes(2);
    expect(writeSpy).toHaveBeenCalledWith("Please type yes or no.\n");
    expect(close).toHaveBeenCalledTimes(1);
    writeSpy.mockRestore();
  });
});
