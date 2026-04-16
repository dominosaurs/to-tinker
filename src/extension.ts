import * as vscode from 'vscode'
import { ToTinkerCodeLensProvider } from './code-lens'
import { COMMANDS, type RunMode } from './commands'
import { getConfig, setSandboxDefaultEnabled } from './config'
import { planRun } from './core/plan/plan-run'
import type { FunctionInfo, MethodInfo } from './extraction'
import { Log } from './log'
import { Output } from './output'
import { promptForParameter } from './php'
import { prepareExecutionEnvironment } from './preflight'
import { executeTinker, RunRegistry, renderExecutionReport } from './runner'
import {
    buildFunctionPayload,
    buildMethodPayload,
    buildTinkerPayload,
} from './wrapper'

const output = new Output()
const log = new Log()
const registry = new RunRegistry()
const codeLensProvider = new ToTinkerCodeLensProvider()

export function activate(context: vscode.ExtensionContext): void {
    output.register(context)
    codeLensProvider.register(context)

    const register = (command: string, mode: RunMode): void => {
        context.subscriptions.push(
            vscode.commands.registerCommand(
                command,
                async (...args: unknown[]) => {
                    await executeRun(mode, args[0])
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
        vscode.commands.registerCommand(COMMANDS.toggleSandbox, async () => {
            await toggleSandbox()
        }),
        vscode.commands.registerCommand(
            COMMANDS.runMethodAt,
            async (uri: vscode.Uri, position: vscode.Position) => {
                await executeRun('method', { position, uri })
            },
        ),
        vscode.commands.registerCommand(
            COMMANDS.runFunctionAt,
            async (uri: vscode.Uri, position: vscode.Position) => {
                await executeRun('function', { position, uri })
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

async function executeRun(mode: RunMode, target?: unknown): Promise<void> {
    try {
        const editor = resolveEditor(target)
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

        const planned = planRun({
            document,
            requestedMode: mode,
            selection: editor.selection,
            selectionsCount: editor.selections.length,
            targetPosition: resolveMethodPosition(editor, target),
        })
        if (!planned.ok) {
            throw new Error(planned.error.message)
        }
        const plan = planned.plan

        const method = plan.strategy === 'method' ? plan.method : undefined
        const callableFunction =
            plan.strategy === 'function' ? plan.callableFunction : undefined
        const payload = await buildPayload(plan, {
            fakeStorage: config.sandbox.fakeStorage,
            filePath: document.uri.fsPath,
            sandboxEnabled,
        })

        const result = await executeTinker(
            {
                callableFunction,
                filePath: document.uri.fsPath,
                method,
                mode: plan.mode,
                payload,
                phpExecutable: environment.phpExecutable,
                sandboxEnabled,
                sourceCode: plan.sourceCode,
                sourceLineEnd: plan.sourceLineEnd,
                sourceLineStart: plan.sourceLineStart,
                workspace: environment.workspace,
            },
            output,
            registry,
            log,
        )

        await renderExecutionReport(
            {
                callableFunction,
                filePath: document.uri.fsPath,
                method,
                mode: plan.mode,
                payload,
                phpExecutable: environment.phpExecutable,
                sandboxEnabled,
                sourceCode: plan.sourceCode,
                sourceLineEnd: plan.sourceLineEnd,
                sourceLineStart: plan.sourceLineStart,
                workspace: environment.workspace,
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

    const mode = editor.selection.isEmpty ? 'file' : 'selection'
    await executeRun(mode, undefined)
}

async function toggleSandbox(): Promise<void> {
    const enabled = !getConfig().sandbox.defaultEnabled
    await setSandboxDefaultEnabled(enabled)
    void vscode.window.showInformationMessage(
        `To Tinker sandbox ${enabled ? 'enabled' : 'disabled'}.`,
    )
}

async function buildPayload(
    plan: import('./core/types/run-plan').RunPlan,
    context: {
        fakeStorage: boolean
        filePath: string
        sandboxEnabled: boolean
    },
): Promise<string> {
    switch (plan.strategy) {
        case 'eval':
            return buildTinkerPayload({
                fakeStorage: context.fakeStorage,
                filePath: context.filePath,
                sandboxEnabled: context.sandboxEnabled,
                selectionOrFileCode: plan.sourceCode,
                smartCapture: plan.smartCapture,
            })
        case 'method':
            return buildMethodPayload({
                fakeStorage: context.fakeStorage,
                filePath: context.filePath,
                method: plan.method,
                promptedArguments: await resolveMethodArguments(plan.method),
                sandboxEnabled: context.sandboxEnabled,
            })
        case 'function':
            return buildFunctionPayload({
                callableFunction: plan.callableFunction,
                fakeStorage: context.fakeStorage,
                filePath: context.filePath,
                functionDeclarationSource: plan.functionDeclarationSource,
                promptedArguments: await resolveFunctionArguments(
                    plan.callableFunction,
                ),
                sandboxEnabled: context.sandboxEnabled,
            })
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

        const value = await promptForParameter(method, parameter)
        argumentsList[index] = value
    }

    return argumentsList
}

async function resolveFunctionArguments(
    callableFunction: FunctionInfo,
): Promise<Record<number, string>> {
    const argumentsList: Record<number, string> = {}

    for (const [index, parameter] of callableFunction.parameters.entries()) {
        if (parameter.hasDefault) {
            continue
        }

        const value = await promptForParameter(callableFunction, parameter)
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
