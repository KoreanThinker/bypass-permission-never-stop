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

function resolvePackageTarget(packageRoot: string): ClaudeCodeTarget | null {
  if (!existsSync(packageRoot)) return null;
  const cliPath = resolveCliMjs(packageRoot);
  if (!cliPath) return null;
  const version = extractVersionFromPackageJson(packageRoot);
  return { path: cliPath, type: "js", version };
}

function findClaudePackageInPnpmVersionRoot(versionRoot: string): ClaudeCodeTarget | null {
  const direct = resolvePackageTarget(join(versionRoot, "node_modules", CLAUDE_PACKAGE));
  if (direct) return direct;

  const pnpmStore = join(versionRoot, ".pnpm");
  if (!existsSync(pnpmStore)) return null;

  try {
    const entries = readdirSync(pnpmStore).filter((e) =>
      e.startsWith("@anthropic-ai+claude-code@")
    );
    for (const entry of entries) {
      const candidate = join(
        pnpmStore,
        entry,
        "node_modules",
        CLAUDE_PACKAGE
      );
      const target = resolvePackageTarget(candidate);
      if (target) return target;
    }
  } catch {
    // Ignore unreadable pnpm store paths.
  }

  return null;
}

function getKnownPnpmGlobalBases(): string[] {
  const home = process.env.HOME || homedir() || "";
  const result = new Set<string>();

  if (home) {
    result.add(join(home, "Library", "pnpm", "global"));
    result.add(join(home, ".local", "share", "pnpm", "global"));
  }

  const pnpmHome = process.env.PNPM_HOME;
  if (pnpmHome) {
    result.add(join(pnpmHome, "global"));
    result.add(join(dirname(pnpmHome), "global"));
  }

  return [...result];
}

export async function findClaudeCodeTarget(): Promise<ClaudeCodeTarget | null> {
  const strategies: Array<() => ClaudeCodeTarget | null> = [
    findViaLocalShare,
    findViaWhich,
    findViaNpmGlobal,
    findViaHomebrew,
    findViaVolta,
    findViaPnpmGlobal,
    findViaKnownPnpmGlobalPaths,
    findViaYarnGlobal,
    findViaClaudeDir,
  ];

  let firstBinaryTarget: ClaudeCodeTarget | null = null;

  for (const strategy of strategies) {
    try {
      const target = strategy();
      if (!target) continue;

      if (target.type === "js") {
        return target;
      }

      if (!firstBinaryTarget) {
        firstBinaryTarget = target;
      }
    } catch {
      // Strategy failed, try next
    }
  }

  return firstBinaryTarget;
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
    return resolvePackageTarget(join(globalRoot, CLAUDE_PACKAGE));
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
    const target = resolvePackageTarget(join(basePath, CLAUDE_PACKAGE));
    if (target) return target;
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
  return resolvePackageTarget(voltaPath);
}

function findViaPnpmGlobal(): ClaudeCodeTarget | null {
  try {
    const pnpmRoot = execSync("pnpm root -g", { encoding: "utf-8" }).trim();
    const direct = resolvePackageTarget(join(pnpmRoot, CLAUDE_PACKAGE));
    if (direct) return direct;

    const versionRoot = dirname(pnpmRoot);
    return findClaudePackageInPnpmVersionRoot(versionRoot);
  } catch {
    // pnpm not available
  }
  return null;
}

function findViaKnownPnpmGlobalPaths(): ClaudeCodeTarget | null {
  const globalBases = getKnownPnpmGlobalBases();

  for (const globalBase of globalBases) {
    if (!existsSync(globalBase)) continue;

    // Common layout: <base>/5/node_modules/...
    try {
      const versionDirs = readdirSync(globalBase)
        .map((entry) => join(globalBase, entry))
        .filter((entryPath) => existsSync(entryPath));

      for (const versionRoot of versionDirs) {
        const target = findClaudePackageInPnpmVersionRoot(versionRoot);
        if (target) return target;
      }
    } catch {
      // Ignore unreadable directories and continue.
    }

    // Fallback layout: <base>/node_modules/...
    const direct = findClaudePackageInPnpmVersionRoot(globalBase);
    if (direct) return direct;
  }

  return null;
}

function findViaYarnGlobal(): ClaudeCodeTarget | null {
  try {
    const yarnDir = execSync("yarn global dir", {
      encoding: "utf-8",
    }).trim();
    return resolvePackageTarget(join(yarnDir, "node_modules", CLAUDE_PACKAGE));
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
