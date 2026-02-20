import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionLogger } from "../src/utils/session-logger.js";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("SessionLogger", () => {
  let tempDir: string;
  let logger: SessionLogger;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "session-logger-test-"));
    logger = new SessionLogger(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("should create the log directory if it does not exist", () => {
      const newDir = join(tempDir, "nested", "logs");
      new SessionLogger(newDir);
      expect(existsSync(newDir)).toBe(true);
    });
  });

  describe("log", () => {
    it("should write a log entry with timestamp", () => {
      logger.log("Started patching");
      const files = getLogFiles(tempDir);
      expect(files.length).toBe(1);
      const content = readFileSync(join(tempDir, files[0]), "utf-8");
      expect(content).toContain("Started patching");
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it("should append multiple entries to the same file", () => {
      logger.log("Entry 1");
      logger.log("Entry 2");
      logger.log("Entry 3");
      const files = getLogFiles(tempDir);
      expect(files.length).toBe(1);
      const content = readFileSync(join(tempDir, files[0]), "utf-8");
      expect(content).toContain("Entry 1");
      expect(content).toContain("Entry 2");
      expect(content).toContain("Entry 3");
    });

    it("should include action type when provided", () => {
      logger.log("Patched ui-patcher", "PATCH");
      const files = getLogFiles(tempDir);
      const content = readFileSync(join(tempDir, files[0]), "utf-8");
      expect(content).toContain("[PATCH]");
    });
  });

  describe("getLogPath", () => {
    it("should return the path to the current log file", () => {
      logger.log("test");
      const logPath = logger.getLogPath();
      expect(logPath).toBeTruthy();
      expect(existsSync(logPath!)).toBe(true);
    });

    it("should return null if no logs written yet", () => {
      const fresh = new SessionLogger(join(tempDir, "fresh"));
      expect(fresh.getLogPath()).toBeNull();
    });
  });
});

function getLogFiles(dir: string): string[] {
  const { readdirSync } = require("node:fs");
  return readdirSync(dir).filter((f: string) => f.endsWith(".log"));
}
