import * as vscode from 'vscode'
import { type AppInfo, type RunReport, renderResultView } from './result-view'

export type { RunReport, RunSummary } from './result-view'

export class Output {
    private appInfo: AppInfo = {
        name: 'To Tinker',
        version: 'dev',
    }
    private panel: vscode.WebviewPanel | undefined

    register(context: vscode.ExtensionContext): void {
        const packageJson = (context.extension?.packageJSON ?? {}) as {
            displayName?: string
            version?: string
        }

        this.appInfo = {
            name: packageJson.displayName || 'To Tinker',
            version: packageJson.version || 'dev',
        }
    }

    dispose(): void {
        this.panel?.dispose()
        this.panel = undefined
    }

    async show(report: RunReport): Promise<void> {
        const panel = this.getOrCreatePanel()
        panel.webview.html = await renderResultView(report, this.appInfo)
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
