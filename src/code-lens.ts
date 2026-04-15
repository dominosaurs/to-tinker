import * as vscode from 'vscode'
import { COMMANDS } from './commands'
import { getConfig } from './config'
import { findMethods, type MethodInfo } from './extraction'

export class ToTinkerCodeLensProvider implements vscode.CodeLensProvider {
    private readonly emitter = new vscode.EventEmitter<void>()
    private refreshTimer: NodeJS.Timeout | undefined

    readonly onDidChangeCodeLenses = this.emitter.event

    register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(
                { language: 'php' },
                this,
            ),
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId !== 'php') {
                    return
                }

                this.scheduleRefresh()
            }),
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration('toTinker.codeLens.enabled')) {
                    this.scheduleRefresh()
                }
            }),
            this.emitter,
        )
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        if (!getConfig().codeLensEnabled || document.languageId !== 'php') {
            return []
        }

        return findMethods(document).map(
            method =>
                new vscode.CodeLens(toMethodRange(document, method), {
                    arguments: [
                        document.uri,
                        document.positionAt(method.start),
                    ],
                    command: COMMANDS.runMethodAt,
                    title: '$(play) To Tinker: Run',
                }),
        )
    }

    private scheduleRefresh(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer)
        }

        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = undefined
            this.emitter.fire()
        }, 120)
    }
}

function toMethodRange(
    document: vscode.TextDocument,
    method: MethodInfo,
): vscode.Range {
    const start = document.positionAt(method.start)
    const end = document.positionAt(method.start + method.methodName.length)
    return new vscode.Range(start, end)
}
