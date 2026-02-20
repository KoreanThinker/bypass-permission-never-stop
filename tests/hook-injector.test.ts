import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HookInjector } from "../src/patcher/hook-injector.js";
import type { PatchEntry } from "../src/version/compatibility.js";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("HookInjector", () => {
  let tempDir: string;
  let injector: HookInjector;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hook-injector-test-"));
    injector = new HookInjector();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("generateNeverStopPatch", () => {
    it("should generate a patch with the correct id", () => {
      const patch = injector.generateNeverStopPatch();
      expect(patch.id).toBe("never-stop-hook");
      expect(patch.search).toBeTruthy();
      expect(patch.replace).toBeTruthy();
      expect(patch.description).toContain("never-stop");
    });

    it("should target the success result yield pattern", () => {
      const patch = injector.generateNeverStopPatch();
      expect(patch.search).toContain("result");
      expect(patch.search).toContain("success");
    });

    it("should generate a real behavior-changing replacement", () => {
      const patch = injector.generateNeverStopPatch();
      expect(patch.replace).not.toBe(patch.search);
      expect(patch.replace).toContain("neverStop");
      expect(patch.replace).toContain("XT.filter");
    });
  });

  describe("injectHook", () => {
    it("should inject the never-stop hook into content", () => {
      // Create content that contains the target pattern
      const content = Buffer.from(
        'yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g'
      );
      const result = injector.injectHook(content);
      expect(result.success).toBe(true);
      expect(result.buffer).toBeDefined();
      expect(result.buffer!.toString("utf-8")).toContain("neverStop");
      expect(result.buffer!.toString("utf-8")).toContain("XT.filter");
    });

    it("should fail gracefully when pattern not found", () => {
      const content = Buffer.from("no matching pattern here");
      const result = injector.injectHook(content);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("buildAllPatches", () => {
    it("should combine UI patches and hook patches", () => {
      const uiPatches: PatchEntry[] = [
        {
          id: "mode-cycle",
          description: "test",
          search: "search1",
          replace: "replace1",
        },
      ];
      const allPatches = injector.buildAllPatches(uiPatches);
      expect(allPatches.length).toBeGreaterThan(uiPatches.length);
      expect(allPatches.some((p) => p.id === "mode-cycle")).toBe(true);
      expect(allPatches.some((p) => p.id === "never-stop-hook")).toBe(true);
    });

    it("should put UI patches before hook patches", () => {
      const uiPatches: PatchEntry[] = [
        {
          id: "ui-patch",
          description: "test",
          search: "search1",
          replace: "replace1",
        },
      ];
      const allPatches = injector.buildAllPatches(uiPatches);
      const uiIdx = allPatches.findIndex((p) => p.id === "ui-patch");
      const hookIdx = allPatches.findIndex((p) => p.id === "never-stop-hook");
      expect(uiIdx).toBeLessThan(hookIdx);
    });
  });

  describe("extractLastUserMessage", () => {
    it("should generate code that extracts user message from messages array", () => {
      const code = injector.getLastUserMessageExtractor();
      expect(code).toContain("user");
      expect(typeof code).toBe("string");
    });
  });

  describe("getCircuitBreakerCode", () => {
    it("should generate circuit breaker injection code", () => {
      const code = injector.getCircuitBreakerCode();
      expect(code).toContain("neverStop");
      expect(code).toContain("_ns_th=5");
      expect(typeof code).toBe("string");
    });
  });

  describe("patchFile", () => {
    it("should apply all patches to a file", () => {
      const filePath = join(tempDir, "target");
      const content =
        'START case"bypassPermissions":return"default" ' +
        'MIDDLE yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g END';
      writeFileSync(filePath, content);

      const uiPatches: PatchEntry[] = [
        {
          id: "mode-cycle",
          description: "test",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ];

      const result = injector.patchFile(filePath, uiPatches);
      expect(result.appliedCount).toBeGreaterThanOrEqual(1);
    });
  });
});
