import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PatchEntry {
  id: string;
  description: string;
  search: string;
  replace: string;
}

export interface PatchSignature {
  versionRange: string;
  minVersion: string;
  maxVersion: string;
  targetType: "binary" | "js";
  patches: PatchEntry[];
}

export interface ValidationResult {
  valid: boolean;
  missingPatches: string[];
}

export function parseVersion(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

export function versionInRange(
  version: string,
  min: string,
  max: string
): boolean {
  const v = parseVersion(version);
  const lo = parseVersion(min);
  const hi = parseVersion(max);
  if (!v || !lo || !hi) return false;

  for (let i = 0; i < 3; i++) {
    if (v[i] < lo[i]) return false;
    if (v[i] > lo[i]) break;
  }

  for (let i = 0; i < 3; i++) {
    if (v[i] > hi[i]) return false;
    if (v[i] < hi[i]) break;
  }

  return true;
}

export class VersionCompatibility {
  private signatures: PatchSignature[] = [];

  constructor(signaturesDir: string) {
    this.loadSignatures(signaturesDir);
  }

  private loadSignatures(dir: string): void {
    if (!existsSync(dir)) return;

    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const content = readFileSync(join(dir, file), "utf-8");
        const sig = JSON.parse(content) as PatchSignature;
        if (sig.versionRange && sig.patches) {
          this.signatures.push(sig);
        }
      } catch {
        // Skip invalid files
      }
    }
  }

  getSignatures(): PatchSignature[] {
    return this.signatures;
  }

  findMatchingSignature(version: string | null): PatchSignature | null {
    if (version) {
      // Try version-specific signatures first (non-generic)
      for (const sig of this.signatures) {
        if (sig.versionRange === "generic") continue;
        if (versionInRange(version, sig.minVersion, sig.maxVersion)) {
          return sig;
        }
      }
    }

    // Fall back to generic
    return this.signatures.find((s) => s.versionRange === "generic") ?? null;
  }

  getSupportedVersions(): string[] {
    return this.signatures
      .filter((s) => s.versionRange !== "generic")
      .map((s) => s.versionRange);
  }

  validatePatches(
    signature: PatchSignature,
    content: Buffer
  ): ValidationResult {
    const text = content.toString("utf-8");
    const missingPatches: string[] = [];

    for (const patch of signature.patches) {
      if (!text.includes(patch.search)) {
        missingPatches.push(patch.id);
      }
    }

    return {
      valid: missingPatches.length === 0,
      missingPatches,
    };
  }
}
