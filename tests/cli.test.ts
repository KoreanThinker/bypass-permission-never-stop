import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildCli, getDefaultPaths, getCliVersion } from "../src/cli.js";
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

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cli-test-"));
    sigDir = join(tempDir, "signatures");
    mkdirSync(sigDir);
  });

  afterEach(() => {
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
});
