import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Scenario = {
  isPatched?: boolean;
  target?: { path: string; type: "binary" | "js"; version: string | null } | null;
  installResult?: { success: boolean; patchedCount?: number; error?: string };
  uninstallResult?: { success: boolean; error?: string };
  supportedVersions?: string[];
};

async function setupCliScenario(s: Scenario) {
  vi.resetModules();

  const logger = {
    banner: vi.fn(),
    costWarning: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  };
  const sessionLog = vi.fn();

  const orch = {
    isPatched: vi.fn(() => s.isPatched ?? false),
    install: vi.fn(() => s.installResult ?? { success: true, patchedCount: 2 }),
    uninstall: vi.fn(() => s.uninstallResult ?? { success: true }),
    getSupportedVersions: vi.fn(() => s.supportedVersions ?? []),
  };

  const findTarget = vi.fn(async () => s.target ?? null);

  vi.doMock("../src/index.js", () => ({
    Orchestrator: vi.fn(() => orch),
  }));
  vi.doMock("../src/finder/target-finder.js", () => ({
    findClaudeCodeTarget: findTarget,
  }));
  vi.doMock("../src/utils/logger.js", () => ({
    Logger: vi.fn().mockImplementation(() => logger),
  }));
  vi.doMock("../src/utils/session-logger.js", () => ({
    SessionLogger: vi.fn().mockImplementation(() => ({
      log: sessionLog,
    })),
  }));

  const { buildCli } = await import("../src/cli.js");
  return { buildCli, logger, sessionLog, orch, findTarget };
}

describe("CLI actions", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: string | number | null | undefined) => {
        throw new Error(`EXIT:${code ?? 0}`);
      }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unmock("../src/index.js");
    vi.unmock("../src/finder/target-finder.js");
    vi.unmock("../src/utils/logger.js");
    vi.unmock("../src/utils/session-logger.js");
  });

  it("runs install action successfully", async () => {
    const { buildCli, logger, sessionLog, orch } = await setupCliScenario({
      target: { path: "/tmp/claude", type: "binary", version: "2.1.39" },
      installResult: { success: true, patchedCount: 3 },
    });
    const cli = buildCli("/tmp/signatures");

    await cli.parseAsync(["node", "cmd"], { from: "node" });

    expect(logger.banner).toHaveBeenCalled();
    expect(logger.costWarning).toHaveBeenCalled();
    expect(orch.install).toHaveBeenCalledWith("/tmp/claude", "2.1.39");
    expect(sessionLog).toHaveBeenCalledWith("Install started", "INSTALL");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("exits when target is already patched", async () => {
    const { buildCli, logger, sessionLog, orch } = await setupCliScenario({
      isPatched: true,
    });
    const cli = buildCli("/tmp/signatures");

    await expect(cli.parseAsync(["node", "cmd"], { from: "node" })).rejects.toThrow("EXIT:1");

    expect(orch.isPatched).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(sessionLog).toHaveBeenCalledWith("Already patched, aborting", "INSTALL");
  });

  it("exits when Claude Code target is not found", async () => {
    const { buildCli, logger } = await setupCliScenario({
      target: null,
      isPatched: false,
    });
    const cli = buildCli("/tmp/signatures");

    await expect(cli.parseAsync(["node", "cmd"], { from: "node" })).rejects.toThrow("EXIT:1");

    expect(logger.error).toHaveBeenCalled();
  });

  it("exits with supported versions when install fails", async () => {
    const { buildCli, logger, orch } = await setupCliScenario({
      target: { path: "/tmp/claude", type: "binary", version: "2.1.39" },
      installResult: { success: false, error: "patch fail" },
      supportedVersions: ["2.1.x", "2.2.x"],
    });
    const cli = buildCli("/tmp/signatures");

    await expect(cli.parseAsync(["node", "cmd"], { from: "node" })).rejects.toThrow("EXIT:1");

    expect(orch.getSupportedVersions).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("Supported versions: 2.1.x, 2.2.x");
  });

  it("runs uninstall action successfully", async () => {
    const { buildCli, logger, sessionLog } = await setupCliScenario({
      uninstallResult: { success: true },
    });
    const cli = buildCli("/tmp/signatures");

    await cli.parseAsync(["node", "cmd", "uninstall"], { from: "node" });

    expect(logger.info).toHaveBeenCalledWith("Restoring original binary...");
    expect(logger.success).toHaveBeenCalledWith("Original binary restored successfully.");
    expect(sessionLog).toHaveBeenCalledWith("Uninstall successful", "UNINSTALL");
  });

  it("exits when uninstall fails", async () => {
    const { buildCli, logger, sessionLog } = await setupCliScenario({
      uninstallResult: { success: false, error: "no backup" },
    });
    const cli = buildCli("/tmp/signatures");

    await expect(
      cli.parseAsync(["node", "cmd", "uninstall"], { from: "node" })
    ).rejects.toThrow("EXIT:1");

    expect(logger.error).toHaveBeenCalledWith("Uninstall failed: no backup");
    expect(sessionLog).toHaveBeenCalledWith("Uninstall failed: no backup", "UNINSTALL");
  });
});
