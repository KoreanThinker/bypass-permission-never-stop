import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  VersionCompatibility,
  type PatchSignature,
  type PatchEntry,
  parseVersion,
  versionInRange,
} from "../src/version/compatibility.js";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("parseVersion", () => {
  it("should parse valid semver", () => {
    expect(parseVersion("2.1.39")).toEqual([2, 1, 39]);
  });

  it("should parse single digit versions", () => {
    expect(parseVersion("0.0.1")).toEqual([0, 0, 1]);
  });

  it("should parse large version numbers", () => {
    expect(parseVersion("12.34.567")).toEqual([12, 34, 567]);
  });

  it("should return null for invalid version", () => {
    expect(parseVersion("abc")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });
});

describe("versionInRange", () => {
  it("should return true when version is in range", () => {
    expect(versionInRange("2.1.39", "2.1.0", "2.1.99")).toBe(true);
  });

  it("should return true for exact min match", () => {
    expect(versionInRange("2.1.0", "2.1.0", "2.1.99")).toBe(true);
  });

  it("should return true for exact max match", () => {
    expect(versionInRange("2.1.99", "2.1.0", "2.1.99")).toBe(true);
  });

  it("should return false when version is below range", () => {
    expect(versionInRange("1.9.99", "2.1.0", "2.1.99")).toBe(false);
  });

  it("should return false when version is above range", () => {
    expect(versionInRange("2.2.0", "2.1.0", "2.1.99")).toBe(false);
  });

  it("should handle major version differences", () => {
    expect(versionInRange("3.0.0", "2.0.0", "2.99.99")).toBe(false);
    expect(versionInRange("1.0.0", "2.0.0", "2.99.99")).toBe(false);
  });

  it("should return false for invalid versions", () => {
    expect(versionInRange("abc", "2.1.0", "2.1.99")).toBe(false);
  });
});

describe("VersionCompatibility", () => {
  let tempDir: string;
  let sigDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "compat-test-"));
    sigDir = join(tempDir, "signatures");
    mkdirSync(sigDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeSignature(filename: string, sig: PatchSignature): void {
    writeFileSync(join(sigDir, filename), JSON.stringify(sig), "utf-8");
  }

  const v21xSig: PatchSignature = {
    versionRange: "2.1.x",
    minVersion: "2.1.0",
    maxVersion: "2.1.99",
    targetType: "binary",
    patches: [
      {
        id: "test-patch-1",
        description: "Test patch",
        search: "case\"bypassPermissions\":return\"default\"",
        replace: "case\"bypassPermissions\":return\"neverStop\"",
      },
    ],
  };

  const genericSig: PatchSignature = {
    versionRange: "generic",
    minVersion: "0.0.0",
    maxVersion: "99.99.99",
    targetType: "binary",
    patches: [
      {
        id: "generic-patch-1",
        description: "Generic patch",
        search: "some-pattern",
        replace: "some-replace",
      },
    ],
  };

  describe("loadSignatures", () => {
    it("should load all signature files from directory", () => {
      writeSignature("v2.1.x.json", v21xSig);
      writeSignature("generic.json", genericSig);

      const compat = new VersionCompatibility(sigDir);
      const sigs = compat.getSignatures();
      expect(sigs.length).toBe(2);
    });

    it("should skip non-json files", () => {
      writeSignature("v2.1.x.json", v21xSig);
      writeFileSync(join(sigDir, "readme.txt"), "not a sig", "utf-8");

      const compat = new VersionCompatibility(sigDir);
      expect(compat.getSignatures().length).toBe(1);
    });

    it("should handle empty directory", () => {
      const compat = new VersionCompatibility(sigDir);
      expect(compat.getSignatures().length).toBe(0);
    });

    it("should skip invalid JSON files", () => {
      writeFileSync(join(sigDir, "bad.json"), "not json", "utf-8");
      const compat = new VersionCompatibility(sigDir);
      expect(compat.getSignatures().length).toBe(0);
    });
  });

  describe("findMatchingSignature", () => {
    it("should find version-specific signature first", () => {
      writeSignature("v2.1.x.json", v21xSig);
      writeSignature("generic.json", genericSig);

      const compat = new VersionCompatibility(sigDir);
      const match = compat.findMatchingSignature("2.1.39");
      expect(match).not.toBeNull();
      expect(match!.versionRange).toBe("2.1.x");
    });

    it("should fall back to generic when no specific match", () => {
      writeSignature("v2.1.x.json", v21xSig);
      writeSignature("generic.json", genericSig);

      const compat = new VersionCompatibility(sigDir);
      const match = compat.findMatchingSignature("3.0.0");
      expect(match).not.toBeNull();
      expect(match!.versionRange).toBe("generic");
    });

    it("should return null when no signatures match", () => {
      writeSignature("v2.1.x.json", v21xSig);
      // No generic fallback

      const compat = new VersionCompatibility(sigDir);
      const match = compat.findMatchingSignature("3.0.0");
      expect(match).toBeNull();
    });

    it("should return null for null version with no generic", () => {
      writeSignature("v2.1.x.json", v21xSig);

      const compat = new VersionCompatibility(sigDir);
      const match = compat.findMatchingSignature(null);
      expect(match).toBeNull();
    });

    it("should return generic for null version when generic exists", () => {
      writeSignature("generic.json", genericSig);

      const compat = new VersionCompatibility(sigDir);
      const match = compat.findMatchingSignature(null);
      expect(match).not.toBeNull();
      expect(match!.versionRange).toBe("generic");
    });
  });

  describe("getSupportedVersions", () => {
    it("should list all non-generic version ranges", () => {
      writeSignature("v2.1.x.json", v21xSig);
      writeSignature("generic.json", genericSig);

      const v22xSig: PatchSignature = {
        ...v21xSig,
        versionRange: "2.2.x",
        minVersion: "2.2.0",
        maxVersion: "2.2.99",
      };
      writeSignature("v2.2.x.json", v22xSig);

      const compat = new VersionCompatibility(sigDir);
      const versions = compat.getSupportedVersions();
      expect(versions).toContain("2.1.x");
      expect(versions).toContain("2.2.x");
      expect(versions).not.toContain("generic");
    });

    it("should return empty array when no signatures", () => {
      const compat = new VersionCompatibility(sigDir);
      expect(compat.getSupportedVersions()).toEqual([]);
    });
  });

  describe("validatePatches", () => {
    it("should validate that all search patterns exist in content", () => {
      writeSignature("v2.1.x.json", v21xSig);

      const compat = new VersionCompatibility(sigDir);
      const content = Buffer.from(
        'stuff case"bypassPermissions":return"default" stuff'
      );
      const sig = compat.findMatchingSignature("2.1.39")!;
      const result = compat.validatePatches(sig, content);
      expect(result.valid).toBe(true);
      expect(result.missingPatches).toEqual([]);
    });

    it("should report missing patches", () => {
      writeSignature("v2.1.x.json", v21xSig);

      const compat = new VersionCompatibility(sigDir);
      const content = Buffer.from("completely different content");
      const sig = compat.findMatchingSignature("2.1.39")!;
      const result = compat.validatePatches(sig, content);
      expect(result.valid).toBe(false);
      expect(result.missingPatches.length).toBe(1);
      expect(result.missingPatches[0]).toBe("test-patch-1");
    });
  });
});
