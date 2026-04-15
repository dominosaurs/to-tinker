import { ChildProcess, spawn } from "node:child_process";
import * as vscode from "vscode";
import { stripAnsi } from "./ansi";
import { getConfig } from "./config";
import { RunKind } from "./commands";
import { MethodInfo } from "./extraction";
import { Output, RunSummary } from "./output";
import { resolvePhpExecutable } from "./php";
import { LaravelWorkspace } from "./workspace";

export interface ExecutionRequest {
  workspace: LaravelWorkspace;
  kind: RunKind;
  payload: string;
  filePath: string;
  sandboxEnabled: boolean;
  method?: MethodInfo;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export class RunRegistry {
  private readonly activeRoots = new Map<string, ChildProcess>();

  has(rootPath: string): boolean {
    return this.activeRoots.has(rootPath);
  }

  start(rootPath: string, process: ChildProcess): void {
    this.activeRoots.set(rootPath, process);
  }

  end(rootPath: string): void {
    this.activeRoots.delete(rootPath);
  }

  killAll(): void {
    for (const process of this.activeRoots.values()) {
      process.kill("SIGKILL");
    }

    this.activeRoots.clear();
  }
}

export async function executeTinker(
  request: ExecutionRequest,
  output: Output,
  registry: RunRegistry,
): Promise<ExecutionResult> {
  if (registry.has(request.workspace.rootPath)) {
    throw new Error(`A To-Tinker run is already active for ${request.workspace.rootPath}.`);
  }

  const config = getConfig();
  const phpExecutable = resolvePhpExecutable();
  const timeoutMs = config.timeoutSeconds * 1000;
  await output.show({
    summary: buildSummary(request),
    status: "running",
    diagnostics: `root=${request.workspace.rootPath}`,
  });

  return await new Promise<ExecutionResult>((resolve, reject) => {
    const child = spawn(phpExecutable, [request.workspace.artisanPath, "tinker"], {
      cwd: request.workspace.rootPath,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    registry.start(request.workspace.rootPath, child);

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let finished = false;

    const complete = (handler: () => void): void => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutHandle);
      registry.end(request.workspace.rootPath);
      handler();
    };

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      complete(() => reject(error));
    });

    child.on("close", () => {
      complete(() =>
        resolve({
          stdout: stripAnsi(stdout),
          stderr: stripAnsi(stderr),
          timedOut,
        }),
      );
    });

    child.stdin.write(request.payload);
    child.stdin.end();
  });
}

export async function renderExecutionReport(
  request: ExecutionRequest,
  result: ExecutionResult,
  output: Output,
): Promise<void> {
  const summary = buildSummary(request);

  if (result.timedOut) {
    await output.show({
      summary,
      status: "timeout",
      error: "Execution timed out.",
      diagnostics: normalizeDiagnostics(result.stderr),
    });
    void vscode.window.showErrorMessage(`To-Tinker run timed out after ${getConfig().timeoutSeconds} seconds.`);
    return;
  }

  const stdout = result.stdout;
  const resultMarker = "__TO_TINKER_RESULT__\n";
  const errorMarker = "__TO_TINKER_ERROR__\n";
  const diagnosticsMarker = "\n__TO_TINKER_DIAGNOSTICS__\n";

  if (stdout.includes(errorMarker)) {
    const [errorBody = "", diagnosticsBody = ""] = stdout
      .split(errorMarker)[1]
      ?.split(diagnosticsMarker) ?? [];
    await output.show({
      summary,
      status: "error",
      error: errorBody.trim() || "Execution failed.",
      diagnostics: normalizeDiagnostics([diagnosticsBody, result.stderr].join("\n")),
    });
    void vscode.window.showErrorMessage("To-Tinker execution failed. See output channel.");
    return;
  }

  if (!stdout.includes(resultMarker)) {
    await output.show({
      summary,
      status: "success",
      result: stdout.trim() || "null",
      diagnostics: normalizeDiagnostics(result.stderr),
    });
    return;
  }

  const [resultBody = "", diagnosticsBody = ""] = stdout
    .split(resultMarker)[1]
    ?.split(diagnosticsMarker) ?? [];
  await output.show({
    summary,
    status: "success",
    result: resultBody.trim() || "null",
    diagnostics: normalizeDiagnostics([diagnosticsBody, result.stderr].join("\n")),
  });
}

function normalizeDiagnostics(value: string): string {
  const text = value.trim();
  return text || "none";
}

function buildSummary(request: ExecutionRequest): RunSummary {
  return {
    kind: request.kind,
    filePath: request.filePath,
    rootPath: request.workspace.rootPath,
    sandboxEnabled: request.sandboxEnabled,
    className: request.method?.className,
    methodName: request.method?.methodName,
  };
}
