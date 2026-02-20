import { readFileSync, writeFileSync, chmodSync, statSync } from "node:fs";
import type { PatchEntry } from "../version/compatibility.js";

export interface PatchResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
}

export interface MultiPatchResult {
  success: boolean;
  buffer?: Buffer;
  appliedCount: number;
  failedPatches: string[];
}

export class UiPatcher {
  applyPatch(content: Buffer, patch: PatchEntry): PatchResult {
    const searchBytes = Buffer.from(patch.search, "utf-8");
    const idx = content.indexOf(searchBytes);

    if (idx === -1) {
      return {
        success: false,
        error: `Pattern "${patch.id}" not found in target`,
      };
    }

    const replaceBytes = Buffer.from(patch.replace, "utf-8");
    const result = Buffer.alloc(
      content.length - searchBytes.length + replaceBytes.length
    );

    content.copy(result, 0, 0, idx);
    replaceBytes.copy(result, idx);
    content.copy(result, idx + replaceBytes.length, idx + searchBytes.length);

    return { success: true, buffer: result };
  }

  applyPatches(content: Buffer, patches: PatchEntry[]): MultiPatchResult {
    let current = content;
    let appliedCount = 0;
    const failedPatches: string[] = [];

    for (const patch of patches) {
      const result = this.applyPatch(current, patch);
      if (result.success) {
        current = result.buffer!;
        appliedCount++;
      } else {
        failedPatches.push(patch.id);
      }
    }

    return {
      success: failedPatches.length === 0,
      buffer: current,
      appliedCount,
      failedPatches,
    };
  }

  patchFile(filePath: string, patches: PatchEntry[]): MultiPatchResult {
    const content = readFileSync(filePath);
    const stats = statSync(filePath);
    const mode = stats.mode & 0o777;

    const result = this.applyPatches(content, patches);

    if (result.appliedCount > 0 && result.buffer) {
      writeFileSync(filePath, result.buffer);
      chmodSync(filePath, mode);
    }

    return result;
  }

  isPatched(content: Buffer, patches: PatchEntry[]): boolean {
    const text = content.toString("utf-8");
    // File is fully patched if ALL replace strings are present
    // AND NO search strings are present
    const allReplacesPresent = patches.every((p) =>
      text.includes(p.replace)
    );
    const noSearchesPresent = patches.every(
      (p) => !text.includes(p.search)
    );
    return allReplacesPresent && noSearchesPresent;
  }
}
