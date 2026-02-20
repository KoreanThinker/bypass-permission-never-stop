import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Orchestrator } from "../src/index.js";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Orchestrator", () => {
  let tempDir: string;
  let sigDir: string;
  let backupDir: string;
  let logDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "orchestrator-test-"));
    sigDir = join(tempDir, "signatures");
    backupDir = join(tempDir, "backups");
    logDir = join(tempDir, "logs");
    mkdirSync(sigDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createFakeTarget(content: string): string {
    const targetPath = join(tempDir, "claude-binary");
    writeFileSync(targetPath, content, "utf-8");
    return targetPath;
  }

  function writeSignature(patches: Array<{ id: string; search: string; replace: string }>): void {
    const sig = {
      versionRange: "generic",
      minVersion: "0.0.0",
      maxVersion: "99.99.99",
      targetType: "binary",
      patches: patches.map((p) => ({
        ...p,
        description: `Patch ${p.id}`,
      })),
    };
    writeFileSync(join(sigDir, "generic.json"), JSON.stringify(sig), "utf-8");
  }

  describe("install", () => {
    it("should patch a target file when patterns match", () => {
      const targetPath = createFakeTarget(
        'case"bypassPermissions":return"default" yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g'
      );
      writeSignature([
        {
          id: "mode-cycle",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ]);

      const orch = new Orchestrator({
        signaturesDir: sigDir,
        backupDir,
        logDir,
      });
      const result = orch.install(targetPath, null);
      expect(result.success).toBe(true);

      const patched = readFileSync(targetPath, "utf-8");
      expect(patched).toContain('return"neverStop"');
    });

    it("should create a backup before patching", () => {
      const targetPath = createFakeTarget(
        'case"bypassPermissions":return"default"'
      );
      writeSignature([
        {
          id: "mode-cycle",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ]);

      const orch = new Orchestrator({
        signaturesDir: sigDir,
        backupDir,
        logDir,
      });
      orch.install(targetPath, null);

      expect(existsSync(backupDir)).toBe(true);
      const manifest = JSON.parse(
        readFileSync(join(backupDir, "manifest.json"), "utf-8")
      );
      expect(manifest.originalPath).toBe(targetPath);
    });

    it("should fail when no signature matches", () => {
      const targetPath = createFakeTarget("some content");
      // No signature files at all (empty dir)

      const orch = new Orchestrator({
        signaturesDir: sigDir,
        backupDir,
        logDir,
      });
      const result = orch.install(targetPath, "99.99.99");
      expect(result.success).toBe(false);
      expect(result.error).toContain("signature");
    });

    it("should fail when patterns don't match", () => {
      const targetPath = createFakeTarget("completely different content");
      writeSignature([
        {
          id: "mode-cycle",
          search: "nonexistent-pattern",
          replace: "replacement",
        },
      ]);

      const orch = new Orchestrator({
        signaturesDir: sigDir,
        backupDir,
        logDir,
      });
      const result = orch.install(targetPath, null);
      expect(result.success).toBe(false);
    });

    it("should not re-patch an already patched file", () => {
      const targetPath = createFakeTarget(
        'case"bypassPermissions":return"default"'
      );
      writeSignature([
        {
          id: "mode-cycle",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ]);

      const orch = new Orchestrator({
        signaturesDir: sigDir,
        backupDir,
        logDir,
      });

      // First install
      orch.install(targetPath, null);

      // Second install should detect already patched
      const result2 = orch.install(targetPath, null);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("already patched");
    });
  });

  describe("uninstall", () => {
    it("should restore the original file from backup", () => {
      const originalContent = 'case"bypassPermissions":return"default"';
      const targetPath = createFakeTarget(originalContent);
      writeSignature([
        {
          id: "mode-cycle",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ]);

      const orch = new Orchestrator({
        signaturesDir: sigDir,
        backupDir,
        logDir,
      });
      orch.install(targetPath, null);
      const result = orch.uninstall();
      expect(result.success).toBe(true);

      const restored = readFileSync(targetPath, "utf-8");
      expect(restored).toBe(originalContent);
    });

    it("should fail when no backup exists", () => {
      const orch = new Orchestrator({
        signaturesDir: sigDir,
        backupDir,
        logDir,
      });
      const result = orch.uninstall();
      expect(result.success).toBe(false);
      expect(result.error).toContain("backup");
    });
  });

  describe("getSupportedVersions", () => {
    it("should return list of supported versions", () => {
      const sig = {
        versionRange: "2.1.x",
        minVersion: "2.1.0",
        maxVersion: "2.1.99",
        targetType: "binary",
        patches: [],
      };
      writeFileSync(join(sigDir, "v2.1.x.json"), JSON.stringify(sig), "utf-8");

      const orch = new Orchestrator({
        signaturesDir: sigDir,
        backupDir,
        logDir,
      });
      const versions = orch.getSupportedVersions();
      expect(versions).toContain("2.1.x");
    });
  });
});
