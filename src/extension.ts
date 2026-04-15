import * as vscode from 'vscode'
import { ToTinkerCodeLensProvider } from './code-lens'
import { COMMANDS, type RunKind } from './commands'
import { getConfig } from './config'
import {
    extractFile,
    extractSelection,
    findMethodAtPosition,
    type MethodInfo,
} from './extraction'
import { Log } from './log'
import { Output } from './output'
import { promptForParameter } from './php'
import { executeTinker, RunRegistry, renderExecutionReport } from './runner'
import { resolveLaravelWorkspace } from './workspace'
import { buildMethodPayload, buildTinkerPayload } from './wrapper'

const output = new Output()
const log = new Log()
const registry = new RunRegistry()
const codeLensProvider = new ToTinkerCodeLensProvider()

export function activate(context: vscode.ExtensionContext): void {
    output.register(context)
    codeLensProvider.register(context)

    const register = (
        command: string,
        kind: RunKind,
        sandboxOverride?: boolean,
    ): void => {
        context.subscriptions.push(
            vscode.commands.registerCommand(
                command,
                async (...args: unknown[]) => {
                    await executeRun(kind, sandboxOverride, args[0])
                },
            ),
        )
    }

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.runPrimary, async () => {
            await runPrimary()
        }),
        vscode.commands.registerCommand(COMMANDS.showLogs, async () => {
            log.show()
        }),
        vscode.commands.registerCommand(
            COMMANDS.runMethodAt,
            async (uri: vscode.Uri, position: vscode.Position) => {
                await executeRun('method', undefined, { position, uri })
            },
        ),
    )

    register(COMMANDS.runSelection, 'selection')
    register(COMMANDS.runSelectionDisableSandbox, 'selection', false)
    register(COMMANDS.runFile, 'file')
    register(COMMANDS.runFileDisableSandbox, 'file', false)
    register(COMMANDS.runMethod, 'method')
    register(COMMANDS.runMethodDisableSandbox, 'method', false)

    context.subscriptions.push({
        dispose() {
            registry.killAll()
            log.dispose()
            output.dispose()
        },
    })
}

export function deactivate(): void {
    registry.killAll()
    log.dispose()
    output.dispose()
}

async function executeRun(
    kind: RunKind,
    sandboxOverride?: boolean,
    target?: unknown,
): Promise<void> {
    try {
        const editor = resolveEditor(target)
        if (!editor) {
            throw new Error('Open a PHP editor first.')
        }

        const document = editor.document
        if (document.languageId !== 'php') {
            throw new Error('Active editor must be a PHP file.')
        }

        const workspace = resolveLaravelWorkspace(document)
        const config = getConfig()
        const sandboxEnabled = sandboxOverride ?? config.sandbox.defaultEnabled

        let method: MethodInfo | undefined
        let payload: string

        switch (kind) {
            case 'selection':
                if (editor.selections.length !== 1) {
                    throw new Error('Multiple selections are not supported.')
                }
                payload = buildTinkerPayload({
                    fakeStorage: config.sandbox.fakeStorage,
                    filePath: document.uri.fsPath,
                    sandboxEnabled,
                    selectionOrFileCode: extractSelection(
                        document,
                        editor.selection,
                    ),
                })
                break
            case 'file':
                payload = buildTinkerPayload({
                    fakeStorage: config.sandbox.fakeStorage,
                    filePath: document.uri.fsPath,
                    sandboxEnabled,
                    selectionOrFileCode: extractFile(document),
                })
                break
            case 'method':
                method = findMethodAtPosition(
                    document,
                    resolveMethodPosition(editor, target),
                )
                payload = buildMethodPayload({
                    fakeStorage: config.sandbox.fakeStorage,
                    filePath: document.uri.fsPath,
                    method,
                    promptedArguments: await resolveMethodArguments(method),
                    sandboxEnabled,
                })
                break
            default:
                throw new Error(`Unsupported run kind: ${String(kind)}`)
        }

        const result = await executeTinker(
            {
                filePath: document.uri.fsPath,
                kind,
                method,
                payload,
                sandboxEnabled,
                workspace,
            },
            output,
            registry,
            log,
        )

        await renderExecutionReport(
            {
                filePath: document.uri.fsPath,
                kind,
                method,
                payload,
                sandboxEnabled,
                workspace,
            },
            result,
            output,
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        void vscode.window.showErrorMessage(message)
    }
}

async function runPrimary(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
        void vscode.window.showErrorMessage('Open a PHP editor first.')
        return
    }

    if (editor.selections.length !== 1) {
        void vscode.window.showErrorMessage(
            'Multiple selections are not supported.',
        )
        return
    }

    const kind = editor.selection.isEmpty ? 'file' : 'selection'
    await executeRun(kind, undefined, undefined)
}

async function resolveMethodArguments(
    method: MethodInfo,
): Promise<Record<number, string>> {
    const argumentsList: Record<number, string> = {}

    for (const [index, parameter] of method.parameters.entries()) {
        if (parameter.resolvableByContainer || parameter.hasDefault) {
            continue
        }

        const value = await promptForParameter(
            parameter.name,
            parameter.signatureHint,
        )
        argumentsList[index] = value
    }

    return argumentsList
}

function resolveEditor(target: unknown): vscode.TextEditor | undefined {
    if (
        target &&
        typeof target === 'object' &&
        'uri' in target &&
        target.uri &&
        typeof target.uri === 'object' &&
        'toString' in target.uri
    ) {
        const uri = target.uri as { toString(): string }

        return (
            vscode.window.visibleTextEditors.find(
                editor => editor.document.uri.toString() === uri.toString(),
            ) ?? vscode.window.activeTextEditor
        )
    }

    return vscode.window.activeTextEditor
}

function resolveMethodPosition(
    editor: vscode.TextEditor,
    target: unknown,
): vscode.Position {
    if (
        target &&
        typeof target === 'object' &&
        'position' in target &&
        target.position &&
        typeof target.position === 'object' &&
        'line' in target.position &&
        'character' in target.position
    ) {
        return target.position as vscode.Position
    }

    return editor.selection.active
}
