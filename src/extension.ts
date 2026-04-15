import * as vscode from 'vscode'
import { COMMANDS, type RunKind } from './commands'
import { getConfig } from './config'
import {
    extractFile,
    extractSelection,
    findMethodAtPosition,
    type MethodInfo,
} from './extraction'
import { Output } from './output'
import { promptForParameter } from './php'
import { executeTinker, RunRegistry, renderExecutionReport } from './runner'
import { resolveLaravelWorkspace } from './workspace'
import { buildMethodPayload, buildTinkerPayload } from './wrapper'

const output = new Output()
const registry = new RunRegistry()

export function activate(context: vscode.ExtensionContext): void {
    output.register(context)

    const register = (
        command: string,
        kind: RunKind,
        sandboxOverride?: boolean,
    ): void => {
        context.subscriptions.push(
            vscode.commands.registerCommand(command, async () => {
                await run(kind, sandboxOverride)
            }),
        )
    }

    register(COMMANDS.runSelection, 'selection')
    register(COMMANDS.runSelectionDisableSandbox, 'selection', false)
    register(COMMANDS.runFile, 'file')
    register(COMMANDS.runFileDisableSandbox, 'file', false)
    register(COMMANDS.runMethod, 'method')
    register(COMMANDS.runMethodDisableSandbox, 'method', false)

    context.subscriptions.push({
        dispose() {
            registry.killAll()
            output.dispose()
        },
    })
}

export function deactivate(): void {
    registry.killAll()
    output.dispose()
}

async function run(kind: RunKind, sandboxOverride?: boolean): Promise<void> {
    try {
        const editor = vscode.window.activeTextEditor
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
                method = findMethodAtPosition(document, editor.selection.active)
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
