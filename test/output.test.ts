import { describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { Output } from "../src/output";

describe("output", () => {
  it("opens markdown preview only once", async () => {
    const output = new Output();
    const executeCommand = vi.mocked(vscode.commands.executeCommand);

    executeCommand.mockClear();

    await output.show({
      summary: {
        kind: "selection",
        filePath: "/tmp/demo.php",
        rootPath: "/tmp",
        sandboxEnabled: true,
      },
      status: "running",
    });

    await output.show({
      summary: {
        kind: "selection",
        filePath: "/tmp/demo.php",
        rootPath: "/tmp",
        sandboxEnabled: true,
      },
      status: "success",
      result: "42",
    });

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith("markdown.showPreviewToSide", expect.anything());
  });
});
