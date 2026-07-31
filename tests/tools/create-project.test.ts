import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/bridge/file-bridge.js", () => ({
  sendCommand: vi.fn().mockResolvedValue({ success: true, data: {} }),
}));

import { sendCommand } from "../../src/bridge/file-bridge.js";
import { getProjectTools } from "../../src/tools/project.js";

const mockedSendCommand = vi.mocked(sendCommand);
const tools = getProjectTools({ tempDir: "/tmp/test", timeoutMs: 1000 });

beforeEach(() => vi.clearAllMocks());

describe("create_project path validation", () => {
  it("rejects a directory path without reaching the bridge", async () => {
    const result = await tools.create_project.handler({ path: "/tmp/mcp-test/film" });
    expect(result.success).toBe(false);
    expect(result.error).toContain(".prproj");
    expect(mockedSendCommand).not.toHaveBeenCalled();
  });

  it("rejects a bare project name", async () => {
    const result = await tools.create_project.handler({ path: "My Project" });
    expect(result.success).toBe(false);
    expect(mockedSendCommand).not.toHaveBeenCalled();
  });

  it("accepts a full .prproj path, case-insensitively", async () => {
    await tools.create_project.handler({ path: "/tmp/mcp-test/A.PRPROJ" });
    expect(mockedSendCommand).toHaveBeenCalledTimes(1);
  });

  it("tolerates surrounding whitespace", async () => {
    await tools.create_project.handler({ path: "  /tmp/mcp-test/A.prproj  " });
    expect(mockedSendCommand).toHaveBeenCalledTimes(1);
    expect(mockedSendCommand.mock.calls[0][0]).toContain("/tmp/mcp-test/A.prproj");
  });
});

describe("create_project result verification", () => {
  it("compares the resulting project file name against the requested one", async () => {
    await tools.create_project.handler({ path: "/tmp/mcp-test/New.prproj" });
    const script = mockedSendCommand.mock.calls[0][0];
    expect(script).toContain("var actual = String(project.path)");
    expect(script).toContain("gotName !== wantName");
    expect(script).toContain("Premiere did not create a project at");
  });

  it("no longer treats a truthy app.project as proof of creation", async () => {
    // app.project is truthy whenever any project is open, so the old
    // `if (!project)` guard passed even when newProject did nothing.
    await tools.create_project.handler({ path: "/tmp/mcp-test/New.prproj" });
    const script = mockedSendCommand.mock.calls[0][0];
    expect(script).not.toMatch(/if \(!project\) return __error\("Failed to create project"\);\s*return __result/);
    expect(script).toContain("verified: true");
  });

  it("reports the still-active project when creation did not happen", async () => {
    await tools.create_project.handler({ path: "/tmp/mcp-test/New.prproj" });
    const script = mockedSendCommand.mock.calls[0][0];
    expect(script).toContain("the active project is still");
  });
});
