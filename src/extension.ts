import * as vscode from 'vscode'
import { ToTinkerCodeLensProvider } from './code-lens'
import { COMMANDS, type RunMode } from './commands'
import { getConfig, setSandboxDefaultEnabled } from './config'
import { shouldShowRunFileForText } from './core/discovery/top-level-file-shape'
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
const RUN_FILE_CONTEXT = 'toTinker.showRunFile'

interface RunRequest {
    requestedMode: RunMode
    target?: unknown
}

export function activate(context: vscode.ExtensionContext): void {
    output.register(context)
    codeLensProvider.register(context)

    void updateRunFileContext(vscode.window.activeTextEditor)

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            void updateRunFileContext(editor)
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            if (
                vscode.window.activeTextEditor &&
                event.document === vscode.window.activeTextEditor.document
            ) {
                void updateRunFileContext(vscode.window.activeTextEditor)
            }
        }),
        vscode.commands.registerCommand(COMMANDS.runDefault, async () => {
            await runDefaultRequest()
        }),
        vscode.commands.registerCommand(COMMANDS.runFile, async () => {
            await runRequest({
                requestedMode: 'file',
            })
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
            displaySourceCode: prepared.plan.displaySourceCode,
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
        const editor = resolveEditor(runRequest.target)

        if (
            editor &&
            runRequest.requestedMode !== 'file' &&
            shouldFallbackEmptySelectionToFile(message, editor)
        ) {
            await runRequestInternalFile(editor, runRequest.target)
            return
        }

        void vscode.window.showErrorMessage(message)
    }
}

async function runRequestInternalFile(
    editor: vscode.TextEditor,
    target?: unknown,
): Promise<void> {
    if (!shouldUseDefaultMode(editor) || !shouldRunFileByDefault(editor)) {
        return
    }

    await runRequest({
        requestedMode: 'file',
        target,
    })
}

async function runDefaultRequest(): Promise<void> {
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
        requestedMode: shouldUseDefaultMode(editor)
            ? resolveDefaultRunMode(editor)
            : 'selection',
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

function resolveDefaultRunMode(editor: vscode.TextEditor): RunMode {
    return shouldRunFileByDefault(editor) ? 'file' : 'line'
}

function shouldUseDefaultMode(editor: vscode.TextEditor): boolean {
    return (
        editor.selection.isEmpty ||
        !editor.document.getText(editor.selection).trim()
    )
}

function shouldFallbackEmptySelectionToFile(
    message: string,
    editor: vscode.TextEditor,
): boolean {
    return (
        message === 'Selection is empty. Select PHP code first.' &&
        shouldUseDefaultMode(editor) &&
        shouldRunFileByDefault(editor)
    )
}

function shouldRunFileByDefault(editor: vscode.TextEditor): boolean {
    const lineNumber = editor.selection.active.line
    const lastRunnableLine = findLastRunnableLine(editor.document)
    if (lineNumber < lastRunnableLine) {
        return false
    }

    return isStructuralCloserLine(editor.document.lineAt(lastRunnableLine).text)
}

function findLastRunnableLine(document: vscode.TextDocument): number {
    for (let line = document.lineCount - 1; line >= 0; line -= 1) {
        const text = document.lineAt(line).text.trim()
        if (text && !isCommentOnlyLine(text)) {
            return line
        }
    }

    return 0
}

function isStructuralCloserLine(text: string): boolean {
    return /^(?:\]|\)|\}|\];|\);|\};)\s*[,]?\s*$/u.test(text.trim())
}

function isCommentOnlyLine(text: string): boolean {
    return /^(?:\/\/|#|\/\*)/u.test(text)
}

async function updateRunFileContext(
    editor: vscode.TextEditor | undefined,
): Promise<void> {
    const visible =
        editor?.document.languageId === 'php'
            ? shouldShowRunFileForText(editor.document.getText())
            : false

    await vscode.commands.executeCommand(
        'setContext',
        RUN_FILE_CONTEXT,
        visible,
    )
}
