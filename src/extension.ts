import * as vscode from 'vscode'
import { ToTinkerCodeLensProvider } from './code-lens'
import { COMMANDS, type RunMode } from './commands'
import { getConfig, setSandboxDefaultEnabled } from './config'
import { type PlanRunInput, planRun } from './core/plan/plan-run'
import { prepareExecution } from './core/prepare/prepare-execution'
import { Log } from './log'
import { Output } from './output'
import { promptForParameter } from './php'
import { prepareExecutionEnvironment } from './preflight'
import { executeTinker, RunRegistry, renderExecutionReport } from './runner'

const output = new Output()
const log = new Log()
const registry = new RunRegistry()
const codeLensProvider = new ToTinkerCodeLensProvider()

interface RunRequest {
    requestedMode: RunMode
    target?: unknown
}

export function activate(context: vscode.ExtensionContext): void {
    output.register(context)
    codeLensProvider.register(context)

    const register = (command: string, mode: RunMode): void => {
        context.subscriptions.push(
            vscode.commands.registerCommand(
                command,
                async (...args: unknown[]) => {
                    await runRequest({
                        requestedMode: mode,
                        target: args[0],
                    })
                },
            ),
        )
    }

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.runPrimary, async () => {
            await runPrimaryRequest()
        }),
        vscode.commands.registerCommand(COMMANDS.showLogs, async () => {
            log.show()
        }),
        vscode.commands.registerCommand(COMMANDS.toggleSandbox, async () => {
            await toggleSandbox()
        }),
        vscode.commands.registerCommand(
            COMMANDS.runMethodAt,
            async (uri: vscode.Uri, position: vscode.Position) => {
                await runRequest({
                    requestedMode: 'method',
                    target: { position, uri },
                })
            },
        ),
        vscode.commands.registerCommand(
            COMMANDS.runFunctionAt,
            async (uri: vscode.Uri, position: vscode.Position) => {
                await runRequest({
                    requestedMode: 'function',
                    target: { position, uri },
                })
            },
        ),
    )

    register(COMMANDS.runSelection, 'selection')
    register(COMMANDS.runFile, 'file')
    register(COMMANDS.runLine, 'line')
    register(COMMANDS.runMethod, 'method')

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

async function runRequest(runRequest: RunRequest): Promise<void> {
    try {
        const editor = resolveEditor(runRequest.target)
        if (!editor) {
            throw new Error('Open a PHP editor first.')
        }

        const document = editor.document
        if (document.languageId !== 'php') {
            throw new Error('Active editor must be a PHP file.')
        }

        if (document.isDirty) {
            const saved = await document.save()
            if (!saved) {
                throw new Error(
                    'Could not save the file before running To Tinker.',
                )
            }
        }

        const environment = prepareExecutionEnvironment(document)
        const config = getConfig()
        const sandboxEnabled = config.sandbox.defaultEnabled

        const planned = planRun(
            createPlanRunInput(
                editor,
                runRequest.requestedMode,
                runRequest.target,
            ),
        )
        if (!planned.ok) {
            throw new Error(planned.error.message)
        }

        const prepared = await prepareExecution(
            planned.plan,
            {
                fakeStorage: config.sandbox.fakeStorage,
                filePath: document.uri.fsPath,
                sandboxEnabled,
            },
            promptForParameter,
        )

        const executionRequest = {
            callableFunction: prepared.callableFunction,
            filePath: document.uri.fsPath,
            method: prepared.method,
            mode: prepared.plan.mode,
            payload: prepared.payload,
            phpExecutable: environment.phpExecutable,
            sandboxEnabled,
            sourceCode: prepared.plan.sourceCode,
            sourceLineEnd: prepared.plan.sourceLineEnd,
            sourceLineStart: prepared.plan.sourceLineStart,
            workspace: environment.workspace,
        }

        const result = await executeTinker(
            executionRequest,
            output,
            registry,
            log,
        )

        await renderExecutionReport(executionRequest, result, output)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        void vscode.window.showErrorMessage(message)
    }
}

async function runPrimaryRequest(): Promise<void> {
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

    await runRequest({
        requestedMode: editor.selection.isEmpty ? 'line' : 'selection',
    })
}

async function toggleSandbox(): Promise<void> {
    const enabled = !getConfig().sandbox.defaultEnabled
    await setSandboxDefaultEnabled(enabled)
    void vscode.window.showInformationMessage(
        `To Tinker sandbox ${enabled ? 'enabled' : 'disabled'}.`,
    )
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

function resolveTargetPosition(
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

function createPlanRunInput(
    editor: vscode.TextEditor,
    requestedMode: RunMode,
    target?: unknown,
): PlanRunInput {
    const document = editor.document
    const selection = editor.selection
    const targetPosition = resolveTargetPosition(editor, target)

    return {
        documentPath: document.uri.fsPath,
        documentText: document.getText(),
        languageId: document.languageId,
        requestedMode,
        selectionActiveOffset: document.offsetAt(selection.active),
        selectionEndLine: selection.end.line,
        selectionEndOffset: document.offsetAt(selection.end),
        selectionStartLine: selection.start.line,
        selectionStartOffset: document.offsetAt(selection.start),
        selectionsCount: editor.selections.length,
        targetOffset: document.offsetAt(targetPosition),
    }
}
