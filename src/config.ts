import * as vscode from "vscode";

export interface SandboxConfig {
  defaultEnabled: boolean;
  fakeStorage: boolean;
}

export interface ExtensionConfig {
  phpPath: string | undefined;
  timeoutSeconds: number;
  clearOutputOnRun: boolean;
  sandbox: SandboxConfig;
}

export function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration("toTinker");

  return {
    phpPath: normalizeOptionalString(config.get<string>("phpPath")),
    timeoutSeconds: Math.max(1, config.get<number>("timeoutSeconds", 15)),
    clearOutputOnRun: config.get<boolean>("clearOutputOnRun", true),
    sandbox: {
      defaultEnabled: config.get<boolean>("sandbox.defaultEnabled", true),
      fakeStorage: config.get<boolean>("sandbox.fakeStorage", false),
    },
  };
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
