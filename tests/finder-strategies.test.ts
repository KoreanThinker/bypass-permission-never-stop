import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findClaudeCodeTarget, findClaudeCodePath } from "../src/finder/target-finder.js";

function writeExecScript(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
  chmodSync(path, 0o755);
}

function writeMachOBinary(path: string): void {
  const buf = Buffer.alloc(64);
  buf.writeUInt32BE(0xfeedfacf, 0);
  writeFileSync(path, buf);
}

describe("findClaudeCodeTarget strategies", () => {
  let tempDir: string;
  let oldHome: string | undefined;
  let oldPath: string | undefined;
  let oldPnpmHome: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "finder-strategy-"));
    oldHome = process.env.HOME;
    oldPath = process.env.PATH;
    oldPnpmHome = process.env.PNPM_HOME;
    process.env.HOME = tempDir;
    delete process.env.PNPM_HOME;
  });

  afterEach(() => {
    process.env.HOME = oldHome;
    process.env.PATH = oldPath;
    process.env.PNPM_HOME = oldPnpmHome;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("prefers latest semver in ~/.local/share/claude/versions", async () => {
    const versionsDir = join(tempDir, ".local", "share", "claude", "versions");
    mkdirSync(versionsDir, { recursive: true });
    writeMachOBinary(join(versionsDir, "2.1.9"));
    writeMachOBinary(join(versionsDir, "2.1.11"));

    const target = await findClaudeCodeTarget();
    expect(target).not.toBeNull();
    expect(target?.path).toBe(join(versionsDir, "2.1.11"));
    expect(target?.type).toBe("binary");
    expect(target?.version).toBe("2.1.11");
  });

  it("prefers pnpm JS target when local binary and pnpm installs both exist", async () => {
    const versionsDir = join(tempDir, ".local", "share", "claude", "versions");
    mkdirSync(versionsDir, { recursive: true });
    writeMachOBinary(join(versionsDir, "2.1.39"));

    const fakeBin = join(tempDir, "bin");
    mkdirSync(fakeBin, { recursive: true });
    process.env.PATH = fakeBin;

    const globalRoot = join(tempDir, "pnpm-global");
    const pkgRoot = join(globalRoot, "@anthropic-ai", "claude-code");
    mkdirSync(pkgRoot, { recursive: true });
    writeFileSync(join(pkgRoot, "package.json"), JSON.stringify({ version: "3.2.1" }), "utf-8");
    writeFileSync(join(pkgRoot, "cli.mjs"), "// pnpm cli\n", "utf-8");

    // which resolves to local binary target
    writeExecScript(
      join(fakeBin, "which"),
      `#!/bin/sh
if [ "$1" = "claude" ]; then
  echo "${join(versionsDir, "2.1.39")}"
  exit 0
fi
exit 1
`
    );
    // npm strategy unavailable
    writeExecScript(join(fakeBin, "npm"), "#!/bin/sh\nexit 1\n");
    // pnpm strategy available
    writeExecScript(
      join(fakeBin, "pnpm"),
      `#!/bin/sh
if [ "$1" = "root" ] && [ "$2" = "-g" ]; then
  echo "${globalRoot}"
  exit 0
fi
exit 1
`
    );

    const target = await findClaudeCodeTarget();
    expect(target).not.toBeNull();
    expect(target?.type).toBe("js");
    expect(target?.path).toBe(join(pkgRoot, "cli.mjs"));
    expect(target?.version).toBe("3.2.1");
  });

  it("finds pnpm global store layout even when pnpm command is unavailable", async () => {
    const versionsDir = join(tempDir, ".local", "share", "claude", "versions");
    mkdirSync(versionsDir, { recursive: true });
    writeMachOBinary(join(versionsDir, "2.1.39"));

    const fakeBin = join(tempDir, "bin");
    mkdirSync(fakeBin, { recursive: true });
    process.env.PATH = fakeBin;

    const pnpmVersionRoot = join(tempDir, "Library", "pnpm", "global", "5");
    const pkgRoot = join(
      pnpmVersionRoot,
      ".pnpm",
      "@anthropic-ai+claude-code@3.2.1",
      "node_modules",
      "@anthropic-ai",
      "claude-code"
    );
    mkdirSync(pkgRoot, { recursive: true });
    writeFileSync(join(pkgRoot, "package.json"), JSON.stringify({ version: "3.2.1" }), "utf-8");
    writeFileSync(join(pkgRoot, "cli.mjs"), "// pnpm store cli\n", "utf-8");

    // which resolves to local binary target
    writeExecScript(
      join(fakeBin, "which"),
      `#!/bin/sh
if [ "$1" = "claude" ]; then
  echo "${join(versionsDir, "2.1.39")}"
  exit 0
fi
exit 1
`
    );
    // package-manager commands unavailable in this shell
    writeExecScript(join(fakeBin, "npm"), "#!/bin/sh\nexit 1\n");
    writeExecScript(join(fakeBin, "pnpm"), "#!/bin/sh\nexit 1\n");
    writeExecScript(join(fakeBin, "yarn"), "#!/bin/sh\nexit 1\n");

    const target = await findClaudeCodeTarget();
    expect(target).not.toBeNull();
    expect(target?.type).toBe("js");
    expect(target?.path).toBe(join(pkgRoot, "cli.mjs"));
    expect(target?.version).toBe("3.2.1");
  });

  it("uses non-semver fallback entry when file is large enough", async () => {
    const versionsDir = join(tempDir, ".local", "share", "claude", "versions");
    mkdirSync(versionsDir, { recursive: true });
    writeFileSync(join(versionsDir, "current"), Buffer.alloc(1_100_000, 0x61));

    const target = await findClaudeCodeTarget();
    expect(target).not.toBeNull();
    expect(target?.path).toBe(join(versionsDir, "current"));
    expect(target?.type).toBe("js");
    expect(target?.version).toBe("current");
  });

  it("finds JS install through `which claude` and resolves package root", async () => {
    const fakeBin = join(tempDir, "bin");
    mkdirSync(fakeBin, { recursive: true });
    process.env.PATH = fakeBin;

    const packageRoot = join(tempDir, "pkg");
    const binDir = join(packageRoot, "bin");
    const distDir = join(packageRoot, "dist");
    mkdirSync(binDir, { recursive: true });
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ version: "9.9.9" }), "utf-8");
    writeFileSync(join(binDir, "claude"), "#!/usr/bin/env node\n", "utf-8");
    writeFileSync(join(distDir, "cli.mjs"), "// cli\n", "utf-8");

    writeExecScript(
      join(fakeBin, "which"),
      `#!/bin/sh
if [ "$1" = "claude" ]; then
  echo "${join(binDir, "claude")}"
  exit 0
fi
exit 1
`
    );

    const target = await findClaudeCodeTarget();
    expect(target).not.toBeNull();
    expect(target?.path).toBe(join(distDir, "cli.mjs"));
    expect(target?.type).toBe("js");
    expect(target?.version).toBe("9.9.9");
  });

  it("falls back to npm global lookup", async () => {
    const fakeBin = join(tempDir, "bin");
    mkdirSync(fakeBin, { recursive: true });
    process.env.PATH = fakeBin;

    const globalRoot = join(tempDir, "global");
    const pkgRoot = join(globalRoot, "@anthropic-ai", "claude-code");
    mkdirSync(pkgRoot, { recursive: true });
    writeFileSync(join(pkgRoot, "package.json"), JSON.stringify({ version: "3.1.4" }), "utf-8");
    writeFileSync(join(pkgRoot, "cli.js"), "// cli\n", "utf-8");

    writeExecScript(join(fakeBin, "which"), "#!/bin/sh\nexit 1\n");
    writeExecScript(
      join(fakeBin, "npm"),
      `#!/bin/sh
if [ "$1" = "root" ] && [ "$2" = "-g" ]; then
  echo "${globalRoot}"
  exit 0
fi
exit 1
`
    );

    const target = await findClaudeCodeTarget();
    expect(target).not.toBeNull();
    expect(target?.path).toBe(join(pkgRoot, "cli.js"));
    expect(target?.type).toBe("js");
    expect(target?.version).toBe("3.1.4");
  });

  it("falls back to ~/.claude when package-manager strategies fail", async () => {
    const fakeBin = join(tempDir, "bin");
    mkdirSync(fakeBin, { recursive: true });
    process.env.PATH = fakeBin;

    writeExecScript(join(fakeBin, "which"), "#!/bin/sh\nexit 1\n");
    writeExecScript(join(fakeBin, "npm"), "#!/bin/sh\nexit 1\n");
    writeExecScript(join(fakeBin, "pnpm"), "#!/bin/sh\nexit 1\n");
    writeExecScript(join(fakeBin, "yarn"), "#!/bin/sh\nexit 1\n");

    const claudeLocal = join(tempDir, ".claude", "local");
    mkdirSync(claudeLocal, { recursive: true });
    writeFileSync(join(claudeLocal, "cli.mjs"), "// cli\n", "utf-8");

    const target = await findClaudeCodeTarget();
    expect(target).not.toBeNull();
    expect(target?.path).toBe(join(claudeLocal, "cli.mjs"));
    expect(target?.type).toBe("js");
    expect(target?.version).toBeNull();
  });

  it("returns null when no strategy can find a target", async () => {
    const fakeBin = join(tempDir, "bin");
    mkdirSync(fakeBin, { recursive: true });
    process.env.PATH = fakeBin;
    writeExecScript(join(fakeBin, "which"), "#!/bin/sh\nexit 1\n");
    writeExecScript(join(fakeBin, "npm"), "#!/bin/sh\nexit 1\n");
    writeExecScript(join(fakeBin, "pnpm"), "#!/bin/sh\nexit 1\n");
    writeExecScript(join(fakeBin, "yarn"), "#!/bin/sh\nexit 1\n");

    const target = await findClaudeCodeTarget();
    expect(target).toBeNull();
    expect(await findClaudeCodePath()).toBeNull();
  });
});
