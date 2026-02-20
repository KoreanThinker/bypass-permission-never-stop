import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UiPatcher } from "../src/patcher/ui-patcher.js";
import type { PatchEntry } from "../src/version/compatibility.js";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("UiPatcher", () => {
  let tempDir: string;
  let patcher: UiPatcher;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ui-patcher-test-"));
    patcher = new UiPatcher();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("applyPatch (single patch)", () => {
    it("should replace search string with replace string in buffer", () => {
      const content = Buffer.from('case"bypassPermissions":return"default"');
      const patch: PatchEntry = {
        id: "test",
        description: "test",
        search: 'case"bypassPermissions":return"default"',
        replace: 'case"bypassPermissions":return"neverStop"',
      };
      const result = patcher.applyPatch(content, patch);
      expect(result.success).toBe(true);
      expect(result.buffer!.toString("utf-8")).toContain('return"neverStop"');
    });

    it("should fail if search pattern not found", () => {
      const content = Buffer.from("no match here");
      const patch: PatchEntry = {
        id: "test",
        description: "test",
        search: "this-does-not-exist",
        replace: "replacement",
      };
      const result = patcher.applyPatch(content, patch);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle binary data around the patch point", () => {
      // Simulate binary content with JS embedded
      const prefix = Buffer.from([0x00, 0xfe, 0xed, 0xfa, 0xcf]);
      const jsCode = Buffer.from('case"bypassPermissions":return"default"');
      const suffix = Buffer.from([0x00, 0x01, 0x02]);
      const content = Buffer.concat([prefix, jsCode, suffix]);

      const patch: PatchEntry = {
        id: "test",
        description: "test",
        search: 'case"bypassPermissions":return"default"',
        replace: 'case"bypassPermissions":return"neverStop"',
      };
      const result = patcher.applyPatch(content, patch);
      expect(result.success).toBe(true);

      // Verify binary prefix/suffix preserved
      const resultBuf = result.buffer!;
      expect(resultBuf[0]).toBe(0x00);
      expect(resultBuf[1]).toBe(0xfe);
      expect(resultBuf[resultBuf.length - 1]).toBe(0x02);
    });

    it("should only replace the first occurrence", () => {
      const content = Buffer.from('ABC case"bypassPermissions":return"default" XYZ case"bypassPermissions":return"default" END');
      const patch: PatchEntry = {
        id: "test",
        description: "test",
        search: 'case"bypassPermissions":return"default"',
        replace: 'case"bypassPermissions":return"neverStop"',
      };
      const result = patcher.applyPatch(content, patch);
      expect(result.success).toBe(true);
      const text = result.buffer!.toString("utf-8");
      // First occurrence replaced
      expect(text.indexOf('return"neverStop"')).toBeGreaterThan(-1);
      // Second occurrence preserved
      expect(text.lastIndexOf('return"default"')).toBeGreaterThan(text.indexOf('return"neverStop"'));
    });
  });

  describe("applyPatches (multiple patches)", () => {
    it("should apply all patches sequentially", () => {
      const content = Buffer.from(
        'HEADER case"bypassPermissions":return"default" MIDDLE case"dontAsk":return"default"}} END'
      );
      const patches: PatchEntry[] = [
        {
          id: "patch-1",
          description: "Mode cycle",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
        {
          id: "patch-2",
          description: "Add neverStop case",
          search: 'case"dontAsk":return"default"}}',
          replace: 'case"dontAsk":return"default";case"neverStop":return"default"}}',
        },
      ];
      const result = patcher.applyPatches(content, patches);
      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(2);
      expect(result.failedPatches).toEqual([]);
      const text = result.buffer!.toString("utf-8");
      expect(text).toContain('return"neverStop"');
      expect(text).toContain('case"neverStop":return"default"');
    });

    it("should report partial failures", () => {
      const content = Buffer.from('case"bypassPermissions":return"default"');
      const patches: PatchEntry[] = [
        {
          id: "good-patch",
          description: "Will succeed",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
        {
          id: "bad-patch",
          description: "Will fail",
          search: "this-pattern-does-not-exist",
          replace: "replacement",
        },
      ];
      const result = patcher.applyPatches(content, patches);
      expect(result.success).toBe(false);
      expect(result.appliedCount).toBe(1);
      expect(result.failedPatches).toEqual(["bad-patch"]);
    });

    it("should handle empty patches array", () => {
      const content = Buffer.from("some content");
      const result = patcher.applyPatches(content, []);
      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(0);
    });
  });

  describe("patchFile", () => {
    it("should patch a file on disk", () => {
      const filePath = join(tempDir, "target");
      writeFileSync(filePath, 'case"bypassPermissions":return"default"');

      const patches: PatchEntry[] = [
        {
          id: "test",
          description: "test",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ];

      const result = patcher.patchFile(filePath, patches);
      expect(result.success).toBe(true);

      const patched = readFileSync(filePath, "utf-8");
      expect(patched).toContain('return"neverStop"');
    });

    it("should preserve file permissions after patching", () => {
      const filePath = join(tempDir, "target");
      writeFileSync(filePath, 'case"bypassPermissions":return"default"');
      const { chmodSync, statSync } = require("node:fs");
      chmodSync(filePath, 0o755);

      const patches: PatchEntry[] = [
        {
          id: "test",
          description: "test",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ];

      patcher.patchFile(filePath, patches);
      const stats = statSync(filePath);
      expect(stats.mode & 0o777).toBe(0o755);
    });

    it("should not modify file if no patches match", () => {
      const filePath = join(tempDir, "target");
      const original = "completely different content";
      writeFileSync(filePath, original);

      const patches: PatchEntry[] = [
        {
          id: "test",
          description: "test",
          search: "nonexistent pattern",
          replace: "replacement",
        },
      ];

      const result = patcher.patchFile(filePath, patches);
      expect(result.success).toBe(false);
      expect(readFileSync(filePath, "utf-8")).toBe(original);
    });
  });

  describe("isPatched", () => {
    it("should detect if file is already patched", () => {
      const content = Buffer.from('case"bypassPermissions":return"neverStop"');
      const patches: PatchEntry[] = [
        {
          id: "test",
          description: "test",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ];
      expect(patcher.isPatched(content, patches)).toBe(true);
    });

    it("should detect unpatched file", () => {
      const content = Buffer.from('case"bypassPermissions":return"default"');
      const patches: PatchEntry[] = [
        {
          id: "test",
          description: "test",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ];
      expect(patcher.isPatched(content, patches)).toBe(false);
    });

    it("should detect partially patched file", () => {
      // Has one replace but not the other search pattern
      const content = Buffer.from(
        'case"bypassPermissions":return"neverStop" case"dontAsk":return"default"}}'
      );
      const patches: PatchEntry[] = [
        {
          id: "patch-1",
          description: "test",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
        {
          id: "patch-2",
          description: "test",
          search: 'case"dontAsk":return"default"}}',
          replace: 'case"dontAsk":return"default";case"neverStop":return"default"}}',
        },
      ];
      // Not fully patched since patch-2 search still exists
      expect(patcher.isPatched(content, patches)).toBe(false);
    });
  });
});
