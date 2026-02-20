import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

interface BackupManifest {
  originalPath: string;
  backupPath: string;
  originalHash: string;
  timestamp: string;
  claudeCodeVersion?: string;
}

const MANIFEST_NAME = "manifest.json";
const BACKUP_NAME = "cli.mjs.backup";

export class BackupManager {
  private readonly backupDir: string;

  constructor(backupDir: string) {
    this.backupDir = backupDir;
  }

  createBackup(targetFile: string, claudeCodeVersion?: string): void {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }

    const content = readFileSync(targetFile);
    const hash = createHash("sha256").update(content).digest("hex");
    const backupPath = join(this.backupDir, BACKUP_NAME);

    copyFileSync(targetFile, backupPath);

    const manifest: BackupManifest = {
      originalPath: targetFile,
      backupPath,
      originalHash: hash,
      timestamp: new Date().toISOString(),
      claudeCodeVersion,
    };

    writeFileSync(
      join(this.backupDir, MANIFEST_NAME),
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );
  }

  restore(): void {
    const manifest = this.getManifest();
    if (!manifest) {
      throw new Error("No backup manifest found. Was the patch ever applied?");
    }

    if (!existsSync(manifest.backupPath)) {
      throw new Error(`Backup file missing: ${manifest.backupPath}`);
    }

    copyFileSync(manifest.backupPath, manifest.originalPath);
    unlinkSync(manifest.backupPath);
    unlinkSync(join(this.backupDir, MANIFEST_NAME));
  }

  isPatched(): boolean {
    return this.getManifest() !== null;
  }

  verifyIntegrity(): boolean {
    const manifest = this.getManifest();
    if (!manifest) return false;

    if (!existsSync(manifest.backupPath)) return false;

    const content = readFileSync(manifest.backupPath);
    const hash = createHash("sha256").update(content).digest("hex");
    return hash === manifest.originalHash;
  }

  getManifest(): BackupManifest | null {
    const manifestPath = join(this.backupDir, MANIFEST_NAME);
    if (!existsSync(manifestPath)) return null;

    try {
      return JSON.parse(readFileSync(manifestPath, "utf-8"));
    } catch {
      return null;
    }
  }
}
