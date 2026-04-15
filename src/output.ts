import * as path from 'node:path'
import * as vscode from 'vscode'

export interface RunSummary {
    kind: string
    filePath: string
    rootPath: string
    sandboxEnabled: boolean
    className?: string
    methodName?: string
}

export interface RunReport {
    summary: RunSummary
    status: 'running' | 'success' | 'error' | 'timeout'
    result?: string
    error?: string
    diagnostics?: string
    stderr?: string
}

export class Output {
    private panel: vscode.WebviewPanel | undefined

    register(_context: vscode.ExtensionContext): void {}

    dispose(): void {
        this.panel?.dispose()
        this.panel = undefined
    }

    async show(report: RunReport): Promise<void> {
        const panel = this.getOrCreatePanel()
        panel.webview.html = renderReport(report)
        panel.reveal(vscode.ViewColumn.Beside, true)
    }

    private getOrCreatePanel(): vscode.WebviewPanel {
        if (this.panel) {
            return this.panel
        }

        this.panel = vscode.window.createWebviewPanel(
            'toTinkerReport',
            'To-Tinker',
            {
                preserveFocus: true,
                viewColumn: vscode.ViewColumn.Beside,
            },
            {
                enableFindWidget: true,
                enableScripts: false,
                retainContextWhenHidden: true,
            },
        )

        this.panel.onDidDispose(() => {
            this.panel = undefined
        })

        return this.panel
    }
}

function renderReport(report: RunReport): string {
    const summary = report.summary
    const fileName = path.basename(summary.filePath)
    const title =
        summary.kind === 'method' && summary.methodName
            ? `${capitalize(summary.kind)}: ${escapeHtml(summary.className ?? '?')}::${escapeHtml(summary.methodName)}`
            : `${capitalize(summary.kind)}: ${escapeHtml(fileName)}`

    const diagnostics = [report.diagnostics?.trim(), report.stderr?.trim()]
        .filter(Boolean)
        .join('\n')

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>To-Tinker</title>
    <style>
        :root {
            color-scheme: light dark;
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --muted: var(--vscode-descriptionForeground);
            --border: var(--vscode-panel-border);
            --ok: #2f9e44;
            --error: #e03131;
            --run: #f08c00;
            --timeout: #c77dff;
            --code-bg: var(--vscode-textCodeBlock-background);
        }

        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 24px;
            background: var(--bg);
            color: var(--fg);
            font: 14px/1.5 var(--vscode-font-family);
        }
        h1, h2 { margin: 0 0 12px; }
        h1 { font-size: 20px; }
        h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-top: 24px; }
        .meta {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 20px;
            color: var(--muted);
        }
        .pill {
            padding: 4px 10px;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: color-mix(in srgb, var(--bg) 88%, var(--fg) 12%);
        }
        .status-ok { color: var(--ok); }
        .status-error { color: var(--error); }
        .status-running { color: var(--run); }
        .status-timeout { color: var(--timeout); }
        pre {
            margin: 0;
            padding: 14px 16px;
            overflow: auto;
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: var(--code-bg);
            color: var(--fg);
            font: 13px/1.45 var(--vscode-editor-font-family);
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="meta">
        <span class="pill status-${report.status}">${escapeHtml(report.status)}</span>
        <span class="pill">${summary.sandboxEnabled ? 'sandbox:on' : 'sandbox:off'}</span>
        <span class="pill">${escapeHtml(shortPath(summary.filePath, summary.rootPath))}</span>
    </div>
    ${report.result ? `<h2>Result</h2><pre>${escapeHtml(report.result)}</pre>` : ''}
    ${report.error ? `<h2>Error</h2><pre>${escapeHtml(report.error)}</pre>` : ''}
    ${diagnostics ? `<h2>Diagnostics</h2><pre>${escapeHtml(diagnostics)}</pre>` : ''}
</body>
</html>`
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function shortPath(filePath: string, rootPath: string): string {
    return filePath.startsWith(rootPath)
        ? filePath.slice(rootPath.length + 1)
        : filePath
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}
