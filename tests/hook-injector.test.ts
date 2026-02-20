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

  describe("getNeverStopPatches", () => {
    it("should expose multiple known hook patch variants", () => {
      const patches = injector.getNeverStopPatches();
      expect(patches.length).toBeGreaterThanOrEqual(2);
      expect(patches.some((p) => p.id === "never-stop-hook-legacy")).toBe(true);
      expect(patches.some((p) => p.id === "never-stop-hook-v2149")).toBe(true);
    });
  });

  describe("generateNeverStopPatch", () => {
    it("should return the legacy patch for backward compatibility", () => {
      const patch = injector.generateNeverStopPatch();
      expect(patch.id).toBe("never-stop-hook-legacy");
      expect(patch.search).toContain("result");
      expect(patch.search).toContain("success");
      expect(patch.replace).toContain("neverStop");
      expect(patch.replace).toContain("XT.filter");
    });
  });

  describe("injectHook", () => {
    it("should inject the legacy never-stop hook into content", () => {
      const content = Buffer.from(
        'yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g'
      );
      const result = injector.injectHook(content);
      expect(result.success).toBe(true);
      expect(result.buffer).toBeDefined();
      expect(result.buffer!.toString("utf-8")).toContain("neverStop");
      expect(result.buffer!.toString("utf-8")).toContain("XT.filter");
    });

    it("should inject the v2.1.49 never-stop hook into content", () => {
      const content = Buffer.from(
        "await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH})},[a6,W1,O1,p6,L6,F,dA,U,PX.suggestions,f6,X6,K5,bH,n6,z6,i6,V,p7]),"
      );
      const result = injector.injectHook(content);
      expect(result.success).toBe(true);
      expect(result.buffer).toBeDefined();
      expect(result.buffer!.toString("utf-8")).toContain("neverStop");
      expect(result.buffer!.toString("utf-8")).toContain(
        "while(K.mode===\"neverStop\"||L6.getState().toolPermissionContext.mode===\"neverStop\")"
      );
      expect(result.buffer!.toString("utf-8")).toContain(
        "await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH})"
      );
      expect(result.buffer!.toString("utf-8")).toContain(",p7,K]),");
      expect(result.buffer!.toString("utf-8")).not.toContain("continue");
    });

    it("should fail gracefully when pattern not found", () => {
      const content = Buffer.from("no matching pattern here");
      const result = injector.injectHook(content);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("buildAllPatches", () => {
    it("should combine UI patches and matching hook patch when content is provided", () => {
      const uiPatches: PatchEntry[] = [
        {
          id: "mode-cycle",
          description: "test",
          search: "search1",
          replace: "replace1",
        },
      ];
      const content = Buffer.from(
        "await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH})},[a6,W1,O1,p6,L6,F,dA,U,PX.suggestions,f6,X6,K5,bH,n6,z6,i6,V,p7]),"
      );
      const allPatches = injector.buildAllPatches(uiPatches, content);
      expect(allPatches.length).toBeGreaterThan(uiPatches.length);
      expect(allPatches.some((p) => p.id === "mode-cycle")).toBe(true);
      expect(allPatches.some((p) => p.id === "never-stop-hook-v2149")).toBe(
        true
      );
    });

    it("should return UI-only list when content has no supported hook pattern", () => {
      const uiPatches: PatchEntry[] = [
        {
          id: "ui-patch",
          description: "test",
          search: "search1",
          replace: "replace1",
        },
      ];
      const allPatches = injector.buildAllPatches(
        uiPatches,
        Buffer.from("nothing here")
      );
      expect(allPatches).toEqual(uiPatches);
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

    it("should select and apply the v2.1.49 hook patch when needed", () => {
      const filePath = join(tempDir, "target-v2149");
      const content =
        'START case"bypassPermissions":return"default" ' +
        "MIDDLE await f6(e6,{setCursorOffset:E6,clearBuffer:K5,resetHistory:bH})},[a6,W1,O1,p6,L6,F,dA,U,PX.suggestions,f6,X6,K5,bH,n6,z6,i6,V,p7]), END";
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
      expect(result.success).toBe(true);
      const patched = readFileSync(filePath, "utf-8");
      expect(patched).toContain(
        "while(K.mode===\"neverStop\"||L6.getState().toolPermissionContext.mode===\"neverStop\")"
      );
    });
  });
});
