import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { createTextDocument } from './helpers'
import { commands, window, workspace } from './vscode'

const executeTinker = vi.fn()
const renderExecutionReport = vi.fn()
const prepareExecutionEnvironment = vi.fn()
const promptForParameter = vi.fn()
const setSandboxDefaultEnabled = vi.fn()
const buildMethodPayload = vi.fn(() => 'method payload')
const buildTinkerPayload = vi.fn(() => 'payload')
const findMethodAtPosition = vi.fn()

vi.mock('../src/runner', async () => {
    const actual =
        await vi.importActual<typeof import('../src/runner')>('../src/runner')

    return {
        ...actual,
        executeTinker,
        renderExecutionReport,
    }
})

vi.mock('../src/preflight', () => ({
    prepareExecutionEnvironment,
}))

vi.mock('../src/config', async () => {
    const actual =
        await vi.importActual<typeof import('../src/config')>('../src/config')

    return {
        ...actual,
        setSandboxDefaultEnabled,
    }
})

vi.mock('../src/php', () => ({
    promptForParameter,
}))

vi.mock('../src/wrapper', () => ({
    buildMethodPayload,
    buildTinkerPayload,
}))

vi.mock('../src/extraction', async () => {
    const actual =
        await vi.importActual<typeof import('../src/extraction')>(
            '../src/extraction',
        )

    return {
        ...actual,
        findMethodAtPosition,
    }
})

describe('extension orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        commands.registerCommand.mockClear()
        executeTinker.mockResolvedValue({
            stderr: '',
            stdout: '__TO_TINKER_RESULT__\n42\n__TO_TINKER_DIAGNOSTICS__\nelapsed_ms=1\n',
            timedOut: false,
        })
        renderExecutionReport.mockResolvedValue(undefined)
        prepareExecutionEnvironment.mockReturnValue({
            phpExecutable: '/usr/bin/php',
            workspace: {
                artisanPath: '/workspace/artisan',
                rootPath: '/workspace',
                workspaceFolder: {
                    index: 0,
                    name: 'demo',
                    uri: vscode.Uri.file('/workspace'),
                },
            },
        })
        promptForParameter.mockResolvedValue("'from prompt'")
        findMethodAtPosition.mockReturnValue({
            className: 'ReportRunner',
            end: 60,
            fullyQualifiedClassName: 'App\\Services\\ReportRunner',
            isStatic: false,
            methodName: 'build',
            parameters: [],
            start: 0,
            visibility: 'public',
        })
        buildMethodPayload.mockReturnValue('method payload')
        buildTinkerPayload.mockReturnValue('payload')
        setSandboxDefaultEnabled.mockResolvedValue(undefined)
    })

    it('runs selection through preflight and execution pipeline', async () => {
        const document = createTextDocument('<?php\n$foo = 1;\n')
        const editor = {
            document,
            selection: new vscode.Selection(
                new vscode.Position(1, 0),
                new vscode.Position(1, 9),
            ),
            selections: [
                new vscode.Selection(
                    new vscode.Position(1, 0),
                    new vscode.Position(1, 9),
                ),
            ],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runPrimary')
        await callback()

        expect(prepareExecutionEnvironment).toHaveBeenCalledWith(document)
        expect(buildTinkerPayload).toHaveBeenCalled()
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'selection',
                phpExecutable: '/usr/bin/php',
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
        expect(renderExecutionReport).toHaveBeenCalled()
    })

    it('shows preflight errors without attempting execution', async () => {
        const document = createTextDocument('<?php\nreturn 1;\n')
        const editor = {
            document,
            selection: new vscode.Selection(
                new vscode.Position(1, 0),
                new vscode.Position(1, 0),
            ),
            selections: [
                new vscode.Selection(
                    new vscode.Position(1, 0),
                    new vscode.Position(1, 0),
                ),
            ],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor
        prepareExecutionEnvironment.mockImplementation(() => {
            throw new Error(
                'Configured PHP path does not exist: /missing/php. Update toTinker.phpPath or clear it to use php from PATH.',
            )
        })

        const { activate } = await import('../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runPrimary')
        await callback()

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Configured PHP path does not exist: /missing/php. Update toTinker.phpPath or clear it to use php from PATH.',
        )
        expect(executeTinker).not.toHaveBeenCalled()
    })

    it('prompts unresolved method parameters with method context', async () => {
        const source = `<?php
class ReportRunner {
    public function build(string $label) {
        return $label;
    }
}`
        const document = createTextDocument(source)
        const cursor = new vscode.Selection(
            new vscode.Position(2, 10),
            new vscode.Position(2, 10),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor
        findMethodAtPosition.mockReturnValue({
            className: 'ReportRunner',
            end: source.length - 1,
            fullyQualifiedClassName: 'ReportRunner',
            isStatic: false,
            methodName: 'build',
            parameters: [
                {
                    hasDefault: false,
                    name: 'label',
                    resolvableByContainer: false,
                    signatureHint: 'string',
                },
            ],
            start: source.indexOf('public function build'),
            visibility: 'public',
        })

        const { activate } = await import('../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runMethod')
        await callback()

        expect(promptForParameter).toHaveBeenCalledWith(
            expect.objectContaining({
                className: 'ReportRunner',
                methodName: 'build',
            }),
            expect.objectContaining({
                name: 'label',
                signatureHint: 'string',
            }),
        )
        expect(buildMethodPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                promptedArguments: { 0: "'from prompt'" },
            }),
        )
    })

    it('toggles sandbox default setting', async () => {
        workspace.getConfiguration.mockImplementation(() => ({
            get: (key: string, defaultValue?: unknown) =>
                key === 'sandbox.defaultEnabled' ? true : defaultValue,
            update: vi.fn(),
        }))

        const { activate } = await import('../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.toggleSandbox')
        await callback()

        expect(setSandboxDefaultEnabled).toHaveBeenCalledWith(false)
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'To Tinker sandbox disabled.',
        )
    })
})

function getRegisteredCommand(
    command: string,
): (...args: unknown[]) => Promise<void> {
    const registered = commands.registerCommand.mock.calls.find(
        ([name]) => name === command,
    )

    if (!registered) {
        throw new Error(`Missing registered command: ${command}`)
    }

    return registered[1] as (...args: unknown[]) => Promise<void>
}
