import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BackupManager } from "../src/backup/backup-manager.js";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

describe("BackupManager", () => {
  let tempDir: string;
  let backupDir: string;
  let targetFile: string;
  let manager: BackupManager;

  const ORIGINAL_CONTENT = "original cli.mjs content here";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "backup-test-"));
    backupDir = join(tempDir, "backups");
    targetFile = join(tempDir, "cli.mjs");
    writeFileSync(targetFile, ORIGINAL_CONTENT, "utf-8");
    manager = new BackupManager(backupDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("createBackup", () => {
    it("should create backup directory if not exists", () => {
      manager.createBackup(targetFile);
      expect(existsSync(backupDir)).toBe(true);
    });

    it("should copy the target file to backup dir", () => {
      manager.createBackup(targetFile);
      const manifest = manager.getManifest();
      expect(manifest).not.toBeNull();
      expect(existsSync(manifest!.backupPath)).toBe(true);
      expect(readFileSync(manifest!.backupPath, "utf-8")).toBe(
        ORIGINAL_CONTENT
      );
    });

    it("should record SHA-256 hash in manifest", () => {
      manager.createBackup(targetFile);
      const manifest = manager.getManifest();
      const expectedHash = createHash("sha256")
        .update(ORIGINAL_CONTENT)
        .digest("hex");
      expect(manifest!.originalHash).toBe(expectedHash);
    });

    it("should record the original file path", () => {
      manager.createBackup(targetFile);
      const manifest = manager.getManifest();
      expect(manifest!.originalPath).toBe(targetFile);
    });

    it("should overwrite previous backup (keep only latest 1)", () => {
      manager.createBackup(targetFile);
      const firstManifest = manager.getManifest();

      writeFileSync(targetFile, "modified content", "utf-8");
      manager.createBackup(targetFile);
      const secondManifest = manager.getManifest();

      expect(secondManifest!.originalHash).not.toBe(
        firstManifest!.originalHash
      );
      // Only 1 backup file should exist (old one overwritten)
      const { readdirSync } = require("node:fs");
      const files = readdirSync(backupDir).filter(
        (f: string) => !f.endsWith(".json")
      );
      expect(files.length).toBe(1);
    });
  });

  describe("restore", () => {
    it("should restore original file from backup", () => {
      manager.createBackup(targetFile);
      writeFileSync(targetFile, "PATCHED CONTENT", "utf-8");
      manager.restore();
      expect(readFileSync(targetFile, "utf-8")).toBe(ORIGINAL_CONTENT);
    });

    it("should remove backup file after restore", () => {
      manager.createBackup(targetFile);
      const manifest = manager.getManifest();
      manager.restore();
      expect(existsSync(manifest!.backupPath)).toBe(false);
    });

    it("should remove manifest after restore", () => {
      manager.createBackup(targetFile);
      manager.restore();
      expect(manager.getManifest()).toBeNull();
    });

    it("should throw if no backup exists", () => {
      expect(() => manager.restore()).toThrow();
    });

    it("should throw if backup file is missing", () => {
      manager.createBackup(targetFile);
      const manifest = manager.getManifest();
      rmSync(manifest!.backupPath);
      expect(() => manager.restore()).toThrow();
    });
  });

  describe("isPatched", () => {
    it("should return false when no backup exists", () => {
      expect(manager.isPatched()).toBe(false);
    });

    it("should return true when backup exists", () => {
      manager.createBackup(targetFile);
      expect(manager.isPatched()).toBe(true);
    });

    it("should return false after restore", () => {
      manager.createBackup(targetFile);
      manager.restore();
      expect(manager.isPatched()).toBe(false);
    });
  });

  describe("verifyIntegrity", () => {
    it("should return true when original hash matches backup", () => {
      manager.createBackup(targetFile);
      expect(manager.verifyIntegrity()).toBe(true);
    });

    it("should return false when backup file is corrupted", () => {
      manager.createBackup(targetFile);
      const manifest = manager.getManifest();
      writeFileSync(manifest!.backupPath, "corrupted", "utf-8");
      expect(manager.verifyIntegrity()).toBe(false);
    });

    it("should return false when no backup exists", () => {
      expect(manager.verifyIntegrity()).toBe(false);
    });
  });
});
