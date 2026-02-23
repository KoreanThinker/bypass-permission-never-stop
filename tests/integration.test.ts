import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Orchestrator } from "../src/index.js";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  chmodSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

/**
 * Integration tests that verify the full install/uninstall flow
 * with realistic content patterns from the RE findings.
 */
describe("Integration: Full Install/Uninstall Flow", () => {
  let tempDir: string;
  let sigDir: string;
  let backupDir: string;
  let logDir: string;

  const REALISTIC_CONTENT = [
    'var GAT,cr0,nk;var diR=X(()=>{GAT=["acceptEdits","bypassPermissions","default","delegate","dontAsk","plan"],cr0=[...GAT],nk=cr0});',
    'function CAT(T){switch(T){case"acceptEdits":case"bypassPermissions":case"default":case"delegate":case"dontAsk":case"plan":return T}}',
    'function Bw(T){switch(T){case"bypassPermissions":return"bypassPermissions";case"acceptEdits":return"acceptEdits";case"plan":return"plan";case"delegate":return"delegate";case"dontAsk":return"dontAsk";case"default":return"default";default:return"default"}}',
    'function Qu(T){switch(T){case"default":return"Default";case"plan":return"Plan Mode";case"delegate":return"Delegate Mode";case"acceptEdits":return"Accept edits";case"bypassPermissions":return"Bypass Permissions";case"dontAsk":return"Don\'t Ask"}}',
    'function VNT(T,R){let A=n9()&&R&&IQ(R);switch(T.mode){case"default":return"acceptEdits";case"acceptEdits":return"plan";case"plan":if(A)return"delegate";if(T.isBypassPermissionsModeAvailable)return"bypassPermissions";return"default";case"delegate":if(T.isBypassPermissionsModeAvailable)return"bypassPermissions";return"default";case"bypassPermissions":return"default";case"dontAsk":return"default"}}',
    'yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g',
  ].join("\n\n");

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "integration-test-"));
    sigDir = join(tempDir, "signatures");
    backupDir = join(tempDir, "backups");
    logDir = join(tempDir, "logs");
    mkdirSync(sigDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeRealisticSignature(): void {
    const sig = {
      versionRange: "2.1.x",
      minVersion: "2.1.0",
      maxVersion: "2.1.99",
      targetType: "binary",
      patches: [
        {
          id: "mode-cycle-bypass-to-neverstop",
          description: "Change bypassPermissions -> default to bypassPermissions -> neverStop",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
        {
          id: "mode-cycle-neverstop-to-default",
          description: "Add neverStop -> default case",
          search: 'case"dontAsk":return"default"}}',
          replace: 'case"dontAsk":return"default";case"neverStop":return"default"}}',
        },
        {
          id: "mode-display-name",
          description: "Add display name",
          search: "case\"dontAsk\":return\"Don't Ask\"}}",
          replace:
            "case\"dontAsk\":return\"Don't Ask\";case\"neverStop\":return\"BYPASS PERMISSION NEVER STOP\"}}",
        },
      ],
    };
    writeFileSync(join(sigDir, "v2.1.x.json"), JSON.stringify(sig), "utf-8");
  }

  it("should complete full install -> verify -> uninstall cycle", () => {
    const targetPath = join(tempDir, "claude");
    writeFileSync(targetPath, REALISTIC_CONTENT);
    chmodSync(targetPath, 0o755);
    writeRealisticSignature();

    const orch = new Orchestrator({ signaturesDir: sigDir, backupDir, logDir });

    // Install
    const installResult = orch.install(targetPath, "2.1.39");
    expect(installResult.success).toBe(true);
    expect(installResult.patchedCount).toBeGreaterThanOrEqual(3);

    // Verify patched content
    const patched = readFileSync(targetPath, "utf-8");
    expect(patched).toContain('return"neverStop"');
    expect(patched).toContain('case"neverStop":return"default"');
    expect(patched).toContain(
      'case"neverStop":return"BYPASS PERMISSION NEVER STOP"'
    );

    // Verify file permissions preserved
    const stats = statSync(targetPath);
    expect(stats.mode & 0o777).toBe(0o755);

    // Verify isPatched returns true
    expect(orch.isPatched()).toBe(true);

    // Uninstall
    const uninstallResult = orch.uninstall();
    expect(uninstallResult.success).toBe(true);

    // Verify original content restored
    const restored = readFileSync(targetPath, "utf-8");
    expect(restored).toBe(REALISTIC_CONTENT);

    // Verify isPatched returns false
    expect(orch.isPatched()).toBe(false);
  });

  it("should prevent double-patching", () => {
    const targetPath = join(tempDir, "claude");
    writeFileSync(targetPath, REALISTIC_CONTENT);
    writeRealisticSignature();

    const orch = new Orchestrator({ signaturesDir: sigDir, backupDir, logDir });

    // First install
    const r1 = orch.install(targetPath, "2.1.39");
    expect(r1.success).toBe(true);

    // Second install should fail
    const r2 = orch.install(targetPath, "2.1.39");
    expect(r2.success).toBe(false);
    expect(r2.error).toContain("already patched");
  });

  it("should hash-verify backup integrity after install", () => {
    const targetPath = join(tempDir, "claude");
    writeFileSync(targetPath, REALISTIC_CONTENT);
    writeRealisticSignature();

    const orch = new Orchestrator({ signaturesDir: sigDir, backupDir, logDir });
    orch.install(targetPath, "2.1.39");

    // Verify backup exists and has valid hash
    const manifestPath = join(backupDir, "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const backupContent = readFileSync(manifest.backupPath);
    const actualHash = createHash("sha256").update(backupContent).digest("hex");
    expect(actualHash).toBe(manifest.originalHash);

    // Verify backup content matches original
    expect(backupContent.toString("utf-8")).toBe(REALISTIC_CONTENT);
  });

  it("should handle version mismatch gracefully", () => {
    const targetPath = join(tempDir, "claude");
    writeFileSync(targetPath, REALISTIC_CONTENT);
    writeRealisticSignature(); // Only supports 2.1.x

    const orch = new Orchestrator({ signaturesDir: sigDir, backupDir, logDir });

    // Try to install with unsupported version
    const result = orch.install(targetPath, "99.0.0");
    expect(result.success).toBe(false);
    expect(result.error).toContain("signature");
  });

  it("should handle generic fallback signature", () => {
    const targetPath = join(tempDir, "claude");
    writeFileSync(
      targetPath,
      'case"bypassPermissions":return"default" yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g'
    );

    // Write generic signature
    const sig = {
      versionRange: "generic",
      minVersion: "0.0.0",
      maxVersion: "99.99.99",
      targetType: "binary",
      patches: [
        {
          id: "mode-cycle",
          description: "test",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ],
    };
    writeFileSync(join(sigDir, "generic.json"), JSON.stringify(sig), "utf-8");

    const orch = new Orchestrator({ signaturesDir: sigDir, backupDir, logDir });
    const result = orch.install(targetPath, "99.0.0");
    expect(result.success).toBe(true);
  });

  it("should log session events during install", () => {
    const targetPath = join(tempDir, "claude");
    writeFileSync(
      targetPath,
      'case"bypassPermissions":return"default" yield{type:"result",subtype:"success",is_error:iR,duration_ms:Date.now()-g'
    );
    const sig = {
      versionRange: "generic",
      minVersion: "0.0.0",
      maxVersion: "99.99.99",
      targetType: "binary",
      patches: [
        {
          id: "test",
          description: "test",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ],
    };
    writeFileSync(join(sigDir, "generic.json"), JSON.stringify(sig), "utf-8");

    const orch = new Orchestrator({ signaturesDir: sigDir, backupDir, logDir });
    orch.install(targetPath, null);

    // Session logger creates log dir but orchestrator doesn't use it directly
    // The CLI uses it - this test just verifies the flow doesn't crash
    expect(orch.isPatched()).toBe(true);
  });
});

describe("Integration: Binary Content Safety", () => {
  let tempDir: string;
  let sigDir: string;
  let backupDir: string;
  let logDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "binary-patch-test-"));
    sigDir = join(tempDir, "signatures");
    backupDir = join(tempDir, "backups");
    logDir = join(tempDir, "logs");
    mkdirSync(sigDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should refuse binary targets instead of patching them", () => {
    // Simulate a Bun-compiled binary with JS embedded
    const binaryPrefix = Buffer.alloc(100, 0x00);
    binaryPrefix.writeUInt32BE(0xfeedfacf, 0); // Mach-O magic
    const jsCode = Buffer.from(
      'case"bypassPermissions":return"default"'
    );
    const binarySuffix = Buffer.alloc(50, 0xff);
    const content = Buffer.concat([binaryPrefix, jsCode, binarySuffix]);

    const targetPath = join(tempDir, "claude-binary");
    writeFileSync(targetPath, content);

    const sig = {
      versionRange: "generic",
      minVersion: "0.0.0",
      maxVersion: "99.99.99",
      targetType: "binary",
      patches: [
        {
          id: "test",
          description: "test",
          search: 'case"bypassPermissions":return"default"',
          replace: 'case"bypassPermissions":return"neverStop"',
        },
      ],
    };
    writeFileSync(join(sigDir, "generic.json"), JSON.stringify(sig), "utf-8");

    const orch = new Orchestrator({ signaturesDir: sigDir, backupDir, logDir });
    const result = orch.install(targetPath, null);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Native executable target detected");

    // Verify binary remains untouched
    const after = readFileSync(targetPath);
    expect(after.equals(content)).toBe(true);
    expect(existsSync(join(backupDir, "manifest.json"))).toBe(false);
  });
});
