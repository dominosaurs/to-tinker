import * as fs from "node:fs";
import * as vscode from "vscode";
import { getConfig } from "./config";

export function resolvePhpExecutable(): string {
  const phpPath = getConfig().phpPath;
  if (!phpPath) {
    return "php";
  }

  if (!fs.existsSync(phpPath)) {
    throw new Error(
      `Configured PHP path is not executable in current extension host environment: ${phpPath}`,
    );
  }

  return phpPath;
}

export async function promptForParameter(
  parameterName: string,
  signatureHint: string,
): Promise<string> {
  const value = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    prompt: `Enter PHP expression for ${parameterName}${signatureHint ? ` (${signatureHint})` : ""}`,
    placeHolder: "Examples: 123, 'text', User::first(), ['a' => 1]",
  });

  if (!value?.trim()) {
    throw new Error(`Missing PHP expression for parameter ${parameterName}.`);
  }

  return value.trim();
}
