import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { createTextDocument } from '../helpers'
import { commands, window, workspace } from '../vscode'

const executeTinker = vi.fn()
const renderExecutionReport = vi.fn()
const prepareExecutionEnvironment = vi.fn()
const promptForParameter = vi.fn()
const setSandboxDefaultEnabled = vi.fn()
const buildFunctionPayload = vi.fn(() => 'function payload')
const buildMethodPayload = vi.fn(() => 'method payload')
const buildTinkerPayload = vi.fn(() => 'payload')
const findFunctionAtPosition = vi.fn()
const findMethodAtPosition = vi.fn()

vi.mock('../../src/runner', async () => {
    const actual =
        await vi.importActual<typeof import('../../src/runner')>(
            '../../src/runner',
        )

    return {
        ...actual,
        executeTinker,
        renderExecutionReport,
    }
})

vi.mock('../../src/preflight', () => ({
    prepareExecutionEnvironment,
}))

vi.mock('../../src/config', async () => {
    const actual =
        await vi.importActual<typeof import('../../src/config')>(
            '../../src/config',
        )

    return {
        ...actual,
        setSandboxDefaultEnabled,
    }
})

vi.mock('../../src/php', () => ({
    promptForParameter,
}))

vi.mock('../../src/wrapper', () => ({
    buildFunctionPayload,
    buildMethodPayload,
    buildTinkerPayload,
}))

vi.mock('../../src/extraction', async () => {
    const actual = await vi.importActual<typeof import('../../src/extraction')>(
        '../../src/extraction',
    )

    return {
        ...actual,
        findFunctionAtPosition,
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
        findFunctionAtPosition.mockReturnValue({
            end: 60,
            fullyQualifiedFunctionName: '\\App\\Support\\build_report',
            functionName: 'build_report',
            nameStart: 0,
            namespaceName: 'App\\Support',
            parameters: [],
            start: 0,
        })
        findMethodAtPosition.mockReturnValue({
            className: 'ReportRunner',
            end: 60,
            fullyQualifiedClassName: 'App\\Services\\ReportRunner',
            isStatic: false,
            methodName: 'build',
            nameStart: 0,
            parameters: [],
            start: 0,
            visibility: 'public',
        })
        buildMethodPayload.mockReturnValue('method payload')
        buildFunctionPayload.mockReturnValue('function payload')
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

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(prepareExecutionEnvironment).toHaveBeenCalledWith(document)
        expect(buildTinkerPayload).toHaveBeenCalled()
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'selection',
                phpExecutable: '/usr/bin/php',
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
        expect(renderExecutionReport).toHaveBeenCalled()
    })

    it('treats a full function declaration selection as function mode', async () => {
        const source = `<?php
function build_report(string $label) {
    return $label;
}
`
        const document = createTextDocument(source)
        const functionStart = source.indexOf('function build_report')
        const functionEnd = source.lastIndexOf('}') + 1
        const editor = {
            document,
            selection: new vscode.Selection(
                document.positionAt(functionStart),
                document.positionAt(functionEnd),
            ),
            selections: [
                new vscode.Selection(
                    document.positionAt(functionStart),
                    document.positionAt(functionEnd),
                ),
            ],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor
        findFunctionAtPosition.mockReset()
        buildTinkerPayload.mockClear()

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildFunctionPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                callableFunction: expect.objectContaining({
                    functionName: 'build_report',
                }),
                functionDeclarationSource: undefined,
            }),
        )
        expect(buildTinkerPayload).not.toHaveBeenCalled()
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                callableFunction: expect.objectContaining({
                    functionName: 'build_report',
                }),
                mode: 'function',
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('treats a selected nested function declaration as function mode with eval-backed source', async () => {
        const source = `<?php
namespace App\\Support;

class Runner {
    public function build() {
        function helper_inside(string $label) {
            return $label;
        }
    }
}
`
        const document = createTextDocument(source)
        const functionStart = source.indexOf('function helper_inside')
        const functionEnd = source.indexOf('\n        }', functionStart) + 10
        const editor = {
            document,
            selection: new vscode.Selection(
                document.positionAt(functionStart),
                document.positionAt(functionEnd),
            ),
            selections: [
                new vscode.Selection(
                    document.positionAt(functionStart),
                    document.positionAt(functionEnd),
                ),
            ],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor
        buildFunctionPayload.mockClear()

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildFunctionPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                callableFunction: expect.objectContaining({
                    functionName: 'helper_inside',
                }),
                functionDeclarationSource: expect.stringContaining(
                    'function helper_inside(string $label)',
                ),
            }),
        )
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                callableFunction: expect.objectContaining({
                    functionName: 'helper_inside',
                }),
                mode: 'function',
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('runs the current line when primary command is used without a selection', async () => {
        const document = createTextDocument('<?php\n$foo = 1;\n')
        const cursor = new vscode.Selection(
            new vscode.Position(1, 0),
            new vscode.Position(1, 0),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$__toTinkerResult = ($foo = 1);',
            }),
        )
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'line',
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('saves a dirty active document before running', async () => {
        const save = vi.fn(async () => true)
        const document = createTextDocument(
            '<?php\n$foo = 1;\n',
            '/tmp/sample.php',
            {
                isDirty: true,
                save,
            },
        )
        const cursor = new vscode.Selection(
            new vscode.Position(1, 0),
            new vscode.Position(1, 0),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(save).toHaveBeenCalled()
    })

    it('aborts the run when saving the active document fails', async () => {
        const save = vi.fn(async () => false)
        const document = createTextDocument(
            '<?php\n$foo = 1;\n',
            '/tmp/sample.php',
            {
                isDirty: true,
                save,
            },
        )
        const cursor = new vscode.Selection(
            new vscode.Position(1, 0),
            new vscode.Position(1, 0),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Could not save the file before running To Tinker.',
        )
        expect(executeTinker).not.toHaveBeenCalled()
    })

    it('runs file mode with last-expression capture for final returnable lines', async () => {
        const document = createTextDocument(`<?php
use Illuminate\\Foundation\\Inspiring;

function getRandom() {
    return rand(1, 10);
}

getRandom();

Inspiring::quote();
`)
        const cursor = new vscode.Selection(
            new vscode.Position(8, 0),
            new vscode.Position(8, 0),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runFile')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: `use Illuminate\\Foundation\\Inspiring;
function getRandom() {
    return rand(1, 10);
}
getRandom();
$__toTinkerResult = (Inspiring::quote());`,
            }),
        )
    })

    it('runs the current line through the execution pipeline', async () => {
        const document = createTextDocument('<?php\n$foo = 1;\n$bar = 2;\n')
        const cursor = new vscode.Selection(
            new vscode.Position(2, 3),
            new vscode.Position(2, 3),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$foo = 1;\n$__toTinkerResult = ($bar = 2);',
            }),
        )
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'line',
                sourceLineEnd: 3,
                sourceLineStart: 1,
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('runs selection mode as file prefix through selection end', async () => {
        const document = createTextDocument(
            '<?php\n$foo = 1;\n$bar = 2;\n$baz = 3;\n',
        )
        const editor = {
            document,
            selection: new vscode.Selection(
                new vscode.Position(2, 0),
                new vscode.Position(2, 9),
            ),
            selections: [
                new vscode.Selection(
                    new vscode.Position(2, 0),
                    new vscode.Position(2, 9),
                ),
            ],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$foo = 1;\n$__toTinkerResult = ($bar = 2);',
            }),
        )
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'selection',
                sourceLineEnd: 3,
                sourceLineStart: 1,
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('runs line inside a method with prior callable context', async () => {
        const document = createTextDocument(`<?php
class ReportRunner {
    public function build() {
        $foo = 1;
        $bar = 2;
    }
}`)
        const cursor = new vscode.Selection(
            new vscode.Position(4, 5),
            new vscode.Position(4, 5),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$foo = 1;\n$__toTinkerResult = ($bar = 2);',
            }),
        )
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'line',
                sourceLineEnd: 5,
                sourceLineStart: 5,
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('runs selection inside a method with prior callable context', async () => {
        const document = createTextDocument(`<?php
class ReportRunner {
    public function build() {
        $foo = 1;
        $bar = 2;
    }
}`)
        const editor = {
            document,
            selection: new vscode.Selection(
                new vscode.Position(3, 8),
                new vscode.Position(3, 16),
            ),
            selections: [
                new vscode.Selection(
                    new vscode.Position(3, 8),
                    new vscode.Position(3, 16),
                ),
            ],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$__toTinkerResult = ($foo = 1);',
            }),
        )
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'selection',
                sourceLineEnd: 4,
                sourceLineStart: 4,
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('runs line inside a plain function with prior callable context', async () => {
        const document = createTextDocument(`<?php
function build() {
    $foo = 1;
    $bar = 2;
}`)
        const cursor = new vscode.Selection(
            new vscode.Position(3, 5),
            new vscode.Position(3, 5),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$foo = 1;\n$__toTinkerResult = ($bar = 2);',
            }),
        )
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'line',
                sourceLineEnd: 4,
                sourceLineStart: 4,
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('runs selection inside a plain function with prior callable context', async () => {
        const document = createTextDocument(`<?php
function build() {
    $foo = 1;
    $bar = 2;
}`)
        const editor = {
            document,
            selection: new vscode.Selection(
                new vscode.Position(2, 4),
                new vscode.Position(2, 12),
            ),
            selections: [
                new vscode.Selection(
                    new vscode.Position(2, 4),
                    new vscode.Position(2, 12),
                ),
            ],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$__toTinkerResult = ($foo = 1);',
            }),
        )
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'selection',
                sourceLineEnd: 3,
                sourceLineStart: 3,
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('runs array-entry lines inside a method as value expressions with prior context', async () => {
        const document = createTextDocument(`<?php
class ReportRunner {
    public function build() {
        $user = User::query()->find(1);
        return [
            'user_name' => $user->name,
        ];
    }
}`)
        const cursor = new vscode.Selection(
            new vscode.Position(4, 33),
            new vscode.Position(4, 33),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode:
                    '$user = User::query()->find(1);\n$__toTinkerResult = ($user->name);',
            }),
        )
    })

    it('runs selected expressions inside a method with prior local context', async () => {
        const source = `<?php
class ReportRunner {
    public function build() {
        $user = User::query()->find(1);
        $user->name = fake()->name();
        return [
            'user_email' => $user->email,
        ];
    }
}`
        const document = createTextDocument(source)
        const start = source.indexOf('$user->email')
        const end = start + '$user->email'.length
        const editor = {
            document,
            selection: new vscode.Selection(
                document.positionAt(start),
                document.positionAt(end),
            ),
            selections: [
                new vscode.Selection(
                    document.positionAt(start),
                    document.positionAt(end),
                ),
            ],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: [
                    '$user = User::query()->find(1);',
                    '$user->name = fake()->name();',
                    '$__toTinkerResult = ($user->email);',
                ].join('\n'),
            }),
        )
    })

    it('treats a full method declaration selection as method mode', async () => {
        const source = `<?php
class ReportRunner {
    public function build(string $label) {
        return $label;
    }
}`
        const document = createTextDocument(source)
        const methodStart = source.indexOf('public function build')
        const methodEnd = source.lastIndexOf('}')
        const editor = {
            document,
            selection: new vscode.Selection(
                document.positionAt(methodStart),
                document.positionAt(methodEnd),
            ),
            selections: [
                new vscode.Selection(
                    document.positionAt(methodStart),
                    document.positionAt(methodEnd),
                ),
            ],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor
        findMethodAtPosition.mockReset()
        buildTinkerPayload.mockClear()

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
        await callback()

        expect(buildMethodPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                method: expect.objectContaining({
                    methodName: 'build',
                }),
            }),
        )
        expect(buildTinkerPayload).not.toHaveBeenCalled()
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                method: expect.objectContaining({
                    methodName: 'build',
                }),
                mode: 'method',
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
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

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runDefault')
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
            nameStart: source.indexOf('build'),
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

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runMethodAt')
        await callback(document.uri, new vscode.Position(2, 10))

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

    it('runs a top-level function through the function execution pipeline', async () => {
        const source = `<?php
function build_report(string $label) {
    return $label;
}`
        const document = createTextDocument(source)
        const cursor = new vscode.Selection(
            new vscode.Position(1, 12),
            new vscode.Position(1, 12),
        )
        const editor = {
            document,
            selection: cursor,
            selections: [cursor],
        }
        window.activeTextEditor = editor as unknown as vscode.TextEditor
        findFunctionAtPosition.mockReturnValue({
            end: source.length - 1,
            fullyQualifiedFunctionName: '\\App\\Support\\build_report',
            functionName: 'build_report',
            nameStart: source.indexOf('build_report'),
            namespaceName: 'App\\Support',
            parameters: [
                {
                    hasDefault: false,
                    name: 'label',
                    resolvableByContainer: false,
                    signatureHint: 'string',
                },
            ],
            start: source.indexOf('function build_report'),
        })

        const { activate } = await import('../../src/extension')
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext
        activate(context)

        const callback = getRegisteredCommand('toTinker.runFunctionAt')
        await callback(document.uri, new vscode.Position(1, 12))

        expect(promptForParameter).toHaveBeenCalledWith(
            expect.objectContaining({
                functionName: 'build_report',
            }),
            expect.objectContaining({
                name: 'label',
                signatureHint: 'string',
            }),
        )
        expect(buildFunctionPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                callableFunction: expect.objectContaining({
                    functionName: 'build_report',
                }),
                promptedArguments: { 0: "'from prompt'" },
            }),
        )
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                callableFunction: expect.objectContaining({
                    functionName: 'build_report',
                }),
                mode: 'function',
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('toggles sandbox default setting', async () => {
        workspace.getConfiguration.mockImplementation(() => ({
            get: (key: string, defaultValue?: unknown) =>
                key === 'sandbox.defaultEnabled' ? true : defaultValue,
            update: vi.fn(),
        }))

        const { activate } = await import('../../src/extension')
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
