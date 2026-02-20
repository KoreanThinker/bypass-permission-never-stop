import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker } from "../src/utils/circuit-breaker.js";

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker(5);
  });

  describe("constructor", () => {
    it("should accept a custom threshold", () => {
      const custom = new CircuitBreaker(3);
      custom.record("err");
      custom.record("err");
      expect(custom.record("err")).toBe(true);
    });

    it("should default to threshold of 5", () => {
      const defaultCb = new CircuitBreaker();
      for (let i = 0; i < 4; i++) {
        expect(defaultCb.record("err")).toBe(false);
      }
      expect(defaultCb.record("err")).toBe(true);
    });
  });

  describe("record", () => {
    it("should return false when fewer errors than threshold", () => {
      expect(cb.record("error A")).toBe(false);
      expect(cb.record("error A")).toBe(false);
      expect(cb.record("error A")).toBe(false);
      expect(cb.record("error A")).toBe(false);
    });

    it("should return true when threshold reached with identical errors", () => {
      cb.record("same error");
      cb.record("same error");
      cb.record("same error");
      cb.record("same error");
      expect(cb.record("same error")).toBe(true);
    });

    it("should use exact string matching", () => {
      cb.record("error at line 1");
      cb.record("error at line 2");
      cb.record("error at line 1");
      cb.record("error at line 2");
      expect(cb.record("error at line 1")).toBe(false);
    });

    it("should not trip when errors are different", () => {
      cb.record("error A");
      cb.record("error B");
      cb.record("error C");
      cb.record("error D");
      expect(cb.record("error E")).toBe(false);
    });

    it("should only track the last N errors (sliding window)", () => {
      cb.record("old error");
      cb.record("old error");
      cb.record("new error");
      cb.record("new error");
      cb.record("new error");
      cb.record("new error");
      expect(cb.record("new error")).toBe(true);
    });

    it("should keep tripping after threshold", () => {
      for (let i = 0; i < 5; i++) cb.record("err");
      expect(cb.record("err")).toBe(true);
    });
  });

  describe("reset", () => {
    it("should clear error history", () => {
      cb.record("err");
      cb.record("err");
      cb.record("err");
      cb.record("err");
      cb.reset();
      expect(cb.record("err")).toBe(false);
    });

    it("should allow re-accumulation after reset", () => {
      cb.reset();
      for (let i = 0; i < 4; i++) cb.record("err");
      expect(cb.record("err")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string errors", () => {
      for (let i = 0; i < 5; i++) cb.record("");
      expect(cb.record("")).toBe(true);
    });

    it("should treat whitespace differences as different errors", () => {
      cb.record("error ");
      cb.record("error");
      cb.record("error ");
      cb.record("error");
      expect(cb.record("error ")).toBe(false);
    });

    it("should handle very long error strings", () => {
      const longError = "x".repeat(10000);
      for (let i = 0; i < 4; i++) cb.record(longError);
      expect(cb.record(longError)).toBe(true);
    });

    it("should work with threshold of 1", () => {
      const strict = new CircuitBreaker(1);
      expect(strict.record("any error")).toBe(true);
    });
  });
});
