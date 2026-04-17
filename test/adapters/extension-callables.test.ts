import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import {
    createCursorEditor,
    createSelection,
    createTextDocument,
} from '../helpers'
import {
    buildFunctionPayload,
    buildMethodPayload,
    buildTinkerPayload,
    executeTinker,
    findFunctionAtPosition,
    findMethodAtPosition,
    promptForParameter,
    useExtensionFixture,
} from './extension-fixture'
import {
    activateAndRunCommand,
    setActiveEditor,
} from './extension-test-helpers'

describe('extension callable modes', () => {
    useExtensionFixture()

    it('treats a full function declaration selection as function mode', async () => {
        const source = `<?php
function build_report(string $label) {
    return $label;
}
`
        const document = createTextDocument(source)
        const functionStart = source.indexOf('function build_report')
        const functionEnd = source.lastIndexOf('}') + 1

        setActiveEditor({
            document,
            selection: createSelection(
                document.positionAt(functionStart),
                document.positionAt(functionEnd),
            ),
            selections: [
                createSelection(
                    document.positionAt(functionStart),
                    document.positionAt(functionEnd),
                ),
            ],
        })
        findFunctionAtPosition.mockReset()
        buildTinkerPayload.mockClear()

        await activateAndRunCommand('toTinker.runDefault')

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

        setActiveEditor({
            document,
            selection: createSelection(
                document.positionAt(functionStart),
                document.positionAt(functionEnd),
            ),
            selections: [
                createSelection(
                    document.positionAt(functionStart),
                    document.positionAt(functionEnd),
                ),
            ],
        })
        buildFunctionPayload.mockClear()

        await activateAndRunCommand('toTinker.runDefault')

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

        setActiveEditor({
            document,
            selection: createSelection(
                document.positionAt(methodStart),
                document.positionAt(methodEnd),
            ),
            selections: [
                createSelection(
                    document.positionAt(methodStart),
                    document.positionAt(methodEnd),
                ),
            ],
        })
        findMethodAtPosition.mockReset()
        buildTinkerPayload.mockClear()

        await activateAndRunCommand('toTinker.runDefault')

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

    it('prompts unresolved method parameters with method context', async () => {
        const source = `<?php
class ReportRunner {
    public function build(string $label) {
        return $label;
    }
}`
        const document = createTextDocument(source)
        setActiveEditor(
            createCursorEditor(document, new vscode.Position(2, 10)),
        )
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

        await activateAndRunCommand(
            'toTinker.runMethodAt',
            document.uri,
            new vscode.Position(2, 10),
        )

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
        setActiveEditor(
            createCursorEditor(document, new vscode.Position(1, 12)),
        )
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

        await activateAndRunCommand(
            'toTinker.runFunctionAt',
            document.uri,
            new vscode.Position(1, 12),
        )

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
})
