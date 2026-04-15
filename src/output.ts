import * as path from "node:path";
import * as vscode from "vscode";

export interface RunSummary {
  kind: string;
  filePath: string;
  rootPath: string;
  sandboxEnabled: boolean;
  className?: string;
  methodName?: string;
}

export interface RunReport {
  summary: RunSummary;
  status: "running" | "success" | "error" | "timeout";
  result?: string;
  error?: string;
  diagnostics?: string;
  stderr?: string;
}

export class Output implements vscode.TextDocumentContentProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly uri = vscode.Uri.parse("to-tinker-report:/latest.md");
  private content = "# To-Tinker\n";
  private previewOpened = false;

  readonly onDidChange = this.emitter.event;

  provideTextDocumentContent(): string {
    return this.content;
  }

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider("to-tinker-report", this),
      this.emitter,
    );
  }

  dispose(): void {
    this.emitter.dispose();
  }

  async show(report: RunReport): Promise<void> {
    this.content = renderReport(report);
    this.emitter.fire(this.uri);

    if (!this.previewOpened) {
      this.previewOpened = true;
      await vscode.commands.executeCommand("markdown.showPreviewToSide", this.uri);
    }
  }
}

function renderReport(report: RunReport): string {
  const summary = report.summary;
  const fileName = path.basename(summary.filePath);
  const title =
    summary.kind === "method" && summary.methodName
      ? `${capitalize(summary.kind)}: ${summary.className ?? "?"}::${summary.methodName}`
      : `${capitalize(summary.kind)}: ${fileName}`;

  const lines = [
    `# ${title}`,
    "",
    `${statusBadge(report.status)} \`${summary.sandboxEnabled ? "sandbox:on" : "sandbox:off"}\` \`${shortPath(summary.filePath, summary.rootPath)}\``,
    "",
  ];

  if (report.result) {
    lines.push("## Result", "", fence(bestLanguage(report.result), report.result), "");
  }

  if (report.error) {
    lines.push("## Error", "", fence("text", report.error), "");
  }

  const diagnostics = [report.diagnostics?.trim(), report.stderr?.trim()].filter(Boolean).join("\n");
  if (diagnostics) {
    lines.push("## Diagnostics", "", fence("text", diagnostics), "");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function statusBadge(status: RunReport["status"]): string {
  switch (status) {
    case "running":
      return "`running`";
    case "success":
      return "`ok`";
    case "error":
      return "`error`";
    case "timeout":
      return "`timeout`";
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shortPath(filePath: string, rootPath: string): string {
  return filePath.startsWith(rootPath) ? filePath.slice(rootPath.length + 1) : filePath;
}

function bestLanguage(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }

  if (trimmed.startsWith("$") || trimmed.includes("=>") || trimmed.includes("::")) {
    return "php";
  }

  return "text";
}

function fence(language: string, value: string): string {
  return `\`\`\`${language}\n${value.trim()}\n\`\`\``;
}
