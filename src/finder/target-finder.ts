import { execSync } from "node:child_process";
import { existsSync, readFileSync, readlinkSync, lstatSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";

const CLAUDE_PACKAGE = "@anthropic-ai/claude-code";
const CLI_FILENAMES = ["cli.mjs", "cli.js"];

export type TargetType = "binary" | "js";

export interface ClaudeCodeTarget {
  path: string;
  type: TargetType;
  version: string | null;
}

export function detectTargetType(filePath: string): TargetType {
  const fd = readFileSync(filePath, { encoding: null, flag: "r" });
  // Mach-O magic: 0xFEEDFACF (64-bit) or 0xFEEDFACE (32-bit)
  if (fd.length >= 4) {
    const magic = fd.readUInt32BE(0);
    if (magic === 0xfeedfacf || magic === 0xfeedface || magic === 0xcafebabe) {
      return "binary";
    }
    // Also check little-endian
    const magicLE = fd.readUInt32LE(0);
    if (magicLE === 0xfeedfacf || magicLE === 0xfeedface) {
      return "binary";
    }
  }
  return "js";
}

export function extractVersionFromBinary(filePath: string): string | null {
  try {
    const content = readFileSync(filePath);
    // Search for VERSION:"x.y.z" pattern in the binary
    const versionPattern = /VERSION:"(\d+\.\d+\.\d+)"/;
    // Read in chunks to find the version string
    const text = content.toString("utf-8", 0, Math.min(content.length, content.length));
    const match = text.match(versionPattern);
    if (match) return match[1];
  } catch {
    // Failed to read
  }
  return null;
}

export function extractVersionFromPackageJson(packageRoot: string): string | null {
  try {
    const pkgPath = join(packageRoot, "package.json");
    if (!existsSync(pkgPath)) return null;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || null;
  } catch {
    return null;
  }
}

export function resolveCliMjs(packageRoot: string): string | null {
  // Check root first, then dist/
  for (const filename of CLI_FILENAMES) {
    const rootPath = join(packageRoot, filename);
    if (existsSync(rootPath)) return rootPath;
  }

  for (const filename of CLI_FILENAMES) {
    const distPath = join(packageRoot, "dist", filename);
    if (existsSync(distPath)) return distPath;
  }

  return null;
}

export async function findClaudeCodeTarget(): Promise<ClaudeCodeTarget | null> {
  const strategies: Array<() => ClaudeCodeTarget | null> = [
    findViaLocalShare,
    findViaWhich,
    findViaNpmGlobal,
    findViaHomebrew,
    findViaVolta,
    findViaPnpmGlobal,
    findViaYarnGlobal,
    findViaClaudeDir,
  ];

  for (const strategy of strategies) {
    try {
      const target = strategy();
      if (target) return target;
    } catch {
      // Strategy failed, try next
    }
  }

  return null;
}

// Legacy compatibility wrapper
export async function findClaudeCodePath(): Promise<string | null> {
  const target = await findClaudeCodeTarget();
  return target?.path ?? null;
}

function findViaLocalShare(): ClaudeCodeTarget | null {
  const home = process.env.HOME || homedir() || "";
  if (!home) return null;

  const versionsDir = join(home, ".local", "share", "claude", "versions");
  if (!existsSync(versionsDir)) return null;

  try {
    const entries = readdirSync(versionsDir);
    // Find the latest version (sort semantically)
    const versions = entries
      .filter((e) => /^\d+\.\d+\.\d+$/.test(e))
      .sort((a, b) => {
        const pa = a.split(".").map(Number);
        const pb = b.split(".").map(Number);
        for (let i = 0; i < 3; i++) {
          if (pa[i] !== pb[i]) return pb[i] - pa[i];
        }
        return 0;
      });

    for (const version of versions) {
      const binaryPath = join(versionsDir, version);
      if (existsSync(binaryPath)) {
        const type = detectTargetType(binaryPath);
        return { path: binaryPath, type, version };
      }
    }

    // Also check non-semver entries (e.g., just the binary)
    for (const entry of entries) {
      const binaryPath = join(versionsDir, entry);
      if (existsSync(binaryPath)) {
        try {
          const stat = lstatSync(binaryPath);
          if (stat.isFile() && stat.size > 1_000_000) {
            const type = detectTargetType(binaryPath);
            return { path: binaryPath, type, version: entry };
          }
        } catch {
          continue;
        }
      }
    }
  } catch {
    // Failed to read versions directory
  }

  return null;
}

function findViaWhich(): ClaudeCodeTarget | null {
  try {
    let binaryPath = execSync("which claude", { encoding: "utf-8" }).trim();
    if (!binaryPath) return null;

    // Follow symlinks to the real file
    const maxDepth = 10;
    for (let i = 0; i < maxDepth; i++) {
      try {
        const stat = lstatSync(binaryPath);
        if (!stat.isSymbolicLink()) break;
        const target = readlinkSync(binaryPath);
        binaryPath = resolve(dirname(binaryPath), target);
      } catch {
        break;
      }
    }

    if (!existsSync(binaryPath)) return null;

    const type = detectTargetType(binaryPath);
    if (type === "binary") {
      // Extract version from path or binary itself
      const pathMatch = binaryPath.match(/(\d+\.\d+\.\d+)/);
      const version = pathMatch ? pathMatch[1] : extractVersionFromBinary(binaryPath);
      return { path: binaryPath, type, version };
    }

    // JS file - walk up to find package root
    let dir = dirname(binaryPath);
    for (let i = 0; i < 10; i++) {
      if (existsSync(join(dir, "package.json"))) {
        const cliPath = resolveCliMjs(dir);
        if (cliPath) {
          const version = extractVersionFromPackageJson(dir);
          return { path: cliPath, type: "js", version };
        }
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // which command failed
  }
  return null;
}

function findViaNpmGlobal(): ClaudeCodeTarget | null {
  try {
    const globalRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
    const candidate = join(globalRoot, CLAUDE_PACKAGE);
    if (existsSync(candidate)) {
      const cliPath = resolveCliMjs(candidate);
      if (cliPath) {
        const version = extractVersionFromPackageJson(candidate);
        return { path: cliPath, type: "js", version };
      }
    }
  } catch {
    // npm not available
  }
  return null;
}

function findViaHomebrew(): ClaudeCodeTarget | null {
  const paths = [
    "/opt/homebrew/lib/node_modules",
    "/usr/local/lib/node_modules",
  ];

  for (const basePath of paths) {
    const candidate = join(basePath, CLAUDE_PACKAGE);
    if (existsSync(candidate)) {
      const cliPath = resolveCliMjs(candidate);
      if (cliPath) {
        const version = extractVersionFromPackageJson(candidate);
        return { path: cliPath, type: "js", version };
      }
    }
  }
  return null;
}

function findViaVolta(): ClaudeCodeTarget | null {
  const home = process.env.HOME || homedir() || "";
  if (!home) return null;

  const voltaPath = join(
    home,
    ".volta",
    "tools",
    "image",
    "packages",
    CLAUDE_PACKAGE
  );
  if (existsSync(voltaPath)) {
    const cliPath = resolveCliMjs(voltaPath);
    if (cliPath) {
      const version = extractVersionFromPackageJson(voltaPath);
      return { path: cliPath, type: "js", version };
    }
  }
  return null;
}

function findViaPnpmGlobal(): ClaudeCodeTarget | null {
  try {
    const pnpmRoot = execSync("pnpm root -g", { encoding: "utf-8" }).trim();
    const candidate = join(pnpmRoot, CLAUDE_PACKAGE);
    if (existsSync(candidate)) {
      const cliPath = resolveCliMjs(candidate);
      if (cliPath) {
        const version = extractVersionFromPackageJson(candidate);
        return { path: cliPath, type: "js", version };
      }
    }
  } catch {
    // pnpm not available
  }
  return null;
}

function findViaYarnGlobal(): ClaudeCodeTarget | null {
  try {
    const yarnDir = execSync("yarn global dir", {
      encoding: "utf-8",
    }).trim();
    const candidate = join(yarnDir, "node_modules", CLAUDE_PACKAGE);
    if (existsSync(candidate)) {
      const cliPath = resolveCliMjs(candidate);
      if (cliPath) {
        const version = extractVersionFromPackageJson(candidate);
        return { path: cliPath, type: "js", version };
      }
    }
  } catch {
    // yarn not available
  }
  return null;
}

function findViaClaudeDir(): ClaudeCodeTarget | null {
  const home = process.env.HOME || homedir() || "";
  if (!home) return null;

  const claudeDir = join(home, ".claude");
  if (!existsSync(claudeDir)) return null;

  // Check common subpaths under .claude
  const candidates = [
    join(claudeDir, "local"),
    join(claudeDir, "bin"),
    claudeDir,
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const cli = resolveCliMjs(candidate);
      if (cli) {
        return { path: cli, type: "js", version: null };
      }
    }
  }

  return null;
}
