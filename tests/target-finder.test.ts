import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  findClaudeCodePath,
  findClaudeCodeTarget,
  resolveCliMjs,
  detectTargetType,
  extractVersionFromBinary,
  extractVersionFromPackageJson,
} from "../src/finder/target-finder.js";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("resolveCliMjs", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "target-finder-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should find cli.mjs in the package root", () => {
    const cliPath = join(tempDir, "cli.mjs");
    writeFileSync(cliPath, "// cli content", "utf-8");
    const result = resolveCliMjs(tempDir);
    expect(result).toBe(cliPath);
  });

  it("should find cli.mjs in dist/", () => {
    const distDir = join(tempDir, "dist");
    mkdirSync(distDir);
    const cliPath = join(distDir, "cli.mjs");
    writeFileSync(cliPath, "// cli content", "utf-8");
    const result = resolveCliMjs(tempDir);
    expect(result).toBe(cliPath);
  });

  it("should prefer root cli.mjs over dist/cli.mjs", () => {
    const rootCli = join(tempDir, "cli.mjs");
    writeFileSync(rootCli, "// root", "utf-8");
    const distDir = join(tempDir, "dist");
    mkdirSync(distDir);
    writeFileSync(join(distDir, "cli.mjs"), "// dist", "utf-8");
    const result = resolveCliMjs(tempDir);
    expect(result).toBe(rootCli);
  });

  it("should return null if cli.mjs not found", () => {
    const result = resolveCliMjs(tempDir);
    expect(result).toBeNull();
  });

  it("should also check for cli.js as fallback", () => {
    const cliPath = join(tempDir, "cli.js");
    writeFileSync(cliPath, "// cli content", "utf-8");
    const result = resolveCliMjs(tempDir);
    expect(result).toBe(cliPath);
  });
});

describe("detectTargetType", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "detect-type-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should detect JS text files", () => {
    const jsFile = join(tempDir, "cli.mjs");
    writeFileSync(jsFile, "#!/usr/bin/env node\nconsole.log('hello');", "utf-8");
    expect(detectTargetType(jsFile)).toBe("js");
  });

  it("should detect Mach-O 64-bit big-endian binary", () => {
    const binFile = join(tempDir, "claude");
    const buf = Buffer.alloc(64);
    // Mach-O 64-bit magic (big-endian): 0xFEEDFACF
    buf.writeUInt32BE(0xfeedfacf, 0);
    writeFileSync(binFile, buf);
    expect(detectTargetType(binFile)).toBe("binary");
  });

  it("should detect Mach-O 64-bit little-endian binary", () => {
    const binFile = join(tempDir, "claude");
    const buf = Buffer.alloc(64);
    // Mach-O 64-bit magic (little-endian)
    buf.writeUInt32LE(0xfeedfacf, 0);
    writeFileSync(binFile, buf);
    expect(detectTargetType(binFile)).toBe("binary");
  });

  it("should detect universal binary (fat binary)", () => {
    const binFile = join(tempDir, "claude");
    const buf = Buffer.alloc(64);
    // Fat/Universal magic: 0xCAFEBABE
    buf.writeUInt32BE(0xcafebabe, 0);
    writeFileSync(binFile, buf);
    expect(detectTargetType(binFile)).toBe("binary");
  });

  it("should treat small/empty files as js", () => {
    const jsFile = join(tempDir, "empty.js");
    writeFileSync(jsFile, "", "utf-8");
    expect(detectTargetType(jsFile)).toBe("js");
  });
});

describe("extractVersionFromBinary", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "version-extract-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should extract version from binary containing VERSION string", () => {
    const binFile = join(tempDir, "claude");
    const content = Buffer.from(
      'some binary data\x00VERSION:"2.1.39"\x00more data'
    );
    writeFileSync(binFile, content);
    expect(extractVersionFromBinary(binFile)).toBe("2.1.39");
  });

  it("should return null if no VERSION string found", () => {
    const binFile = join(tempDir, "claude");
    writeFileSync(binFile, Buffer.from("no version here"));
    expect(extractVersionFromBinary(binFile)).toBeNull();
  });

  it("should extract multi-digit version numbers", () => {
    const binFile = join(tempDir, "claude");
    const content = Buffer.from('data VERSION:"12.34.567" data');
    writeFileSync(binFile, content);
    expect(extractVersionFromBinary(binFile)).toBe("12.34.567");
  });
});

describe("extractVersionFromPackageJson", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "pkg-version-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should extract version from package.json", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "test", version: "1.2.3" }),
      "utf-8"
    );
    expect(extractVersionFromPackageJson(tempDir)).toBe("1.2.3");
  });

  it("should return null if no package.json", () => {
    expect(extractVersionFromPackageJson(tempDir)).toBeNull();
  });

  it("should return null for invalid JSON", () => {
    writeFileSync(join(tempDir, "package.json"), "not json", "utf-8");
    expect(extractVersionFromPackageJson(tempDir)).toBeNull();
  });
});

describe("findClaudeCodeTarget", () => {
  it("should return a target or null", async () => {
    const result = await findClaudeCodeTarget();
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("should find Claude Code if installed on this system", async () => {
    const result = await findClaudeCodeTarget();
    if (result !== null) {
      expect(result.path).toBeTruthy();
      expect(["binary", "js"]).toContain(result.type);
    }
  });
});

describe("findClaudeCodePath (legacy)", () => {
  it("should return a string or null", async () => {
    const result = await findClaudeCodePath();
    expect(result === null || typeof result === "string").toBe(true);
  });
});
