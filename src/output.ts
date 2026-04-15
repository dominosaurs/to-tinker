import * as vscode from 'vscode'
import { type RunReport, renderResultView } from './result-view'

export type { RunReport, RunSummary } from './result-view'

export class Output {
    private panel: vscode.WebviewPanel | undefined

    register(_context: vscode.ExtensionContext): void {}

    dispose(): void {
        this.panel?.dispose()
        this.panel = undefined
    }

    async show(report: RunReport): Promise<void> {
        const panel = this.getOrCreatePanel()
        panel.webview.html = await renderResultView(report)
        panel.reveal(vscode.ViewColumn.Beside, true)
    }

    private getOrCreatePanel(): vscode.WebviewPanel {
        if (this.panel) {
            return this.panel
        }

        this.panel = vscode.window.createWebviewPanel(
            'toTinkerReport',
            'To Tinker',
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
