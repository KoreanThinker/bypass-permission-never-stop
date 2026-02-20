import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "../src/utils/logger.js";

describe("Logger", () => {
  let logger: Logger;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new Logger();
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe("info", () => {
    it("should output [*] prefix", () => {
      logger.info("Scanning...");
      const output = stdoutSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain("[*]");
      expect(output).toContain("Scanning...");
    });
  });

  describe("success", () => {
    it("should output [+] prefix", () => {
      logger.success("Done.");
      const output = stdoutSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain("[+]");
      expect(output).toContain("Done.");
    });
  });

  describe("error", () => {
    it("should output [-] prefix to stderr", () => {
      logger.error("Failed.");
      const output = stderrSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain("[-]");
      expect(output).toContain("Failed.");
    });
  });

  describe("warn", () => {
    it("should output [!] prefix to stderr", () => {
      logger.warn("Caution.");
      const output = stderrSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain("[!]");
      expect(output).toContain("Caution.");
    });
  });

  describe("banner", () => {
    it("should output the project name", () => {
      logger.banner();
      const output = stdoutSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain("bypass-permission-never-stop");
    });
  });

  describe("costWarning", () => {
    it("should output token consumption notice", () => {
      logger.costWarning();
      const output = stdoutSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain("consume many tokens");
      expect(output).toContain("Ctrl+C");
    });
  });
});
