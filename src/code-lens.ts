import * as vscode from 'vscode'
import { COMMANDS } from './commands'
import { getConfig } from './config'
import {
    type FunctionInfo,
    findFunctions,
    findMethods,
    type MethodInfo,
} from './extraction'

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

        return [
            ...findFunctions(document).map(
                callable =>
                    new vscode.CodeLens(toCallableRange(document, callable), {
                        arguments: [
                            document.uri,
                            document.positionAt(callable.start),
                        ],
                        command: COMMANDS.runFunctionAt,
                        title: '$(play) To Tinker: Run',
                    }),
            ),
            ...findMethods(document).map(
                method =>
                    new vscode.CodeLens(toCallableRange(document, method), {
                        arguments: [
                            document.uri,
                            document.positionAt(method.start),
                        ],
                        command: COMMANDS.runMethodAt,
                        title: '$(play) To Tinker: Run',
                    }),
            ),
        ]
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

function toCallableRange(
    document: vscode.TextDocument,
    callable: MethodInfo | FunctionInfo,
): vscode.Range {
    const name =
        'methodName' in callable ? callable.methodName : callable.functionName
    const start = document.positionAt(callable.nameStart)
    const end = document.positionAt(callable.nameStart + name.length)
    return new vscode.Range(start, end)
}
