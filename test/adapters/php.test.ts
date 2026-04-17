import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { promptForParameter, resolvePhpExecutable } from '../../src/php'

describe('php', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reports missing configured php path with next step guidance', () => {
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) =>
                key === 'phpPath' ? '/missing/php' : defaultValue,
        } as ReturnType<typeof vscode.workspace.getConfiguration>)

        expect(() => resolvePhpExecutable()).toThrow(
            'Configured PHP path does not exist: /missing/php. Update toTinker.phpPath or clear it to use php from PATH.',
        )
    })

    it('includes method context when prompting for unresolved parameters', async () => {
        const showInputBox = vi.mocked(vscode.window.showInputBox)
        showInputBox.mockResolvedValue("'demo'")

        const value = await promptForParameter(
            {
                className: 'ReportRunner',
                end: 10,
                fullyQualifiedClassName: 'App\\Services\\ReportRunner',
                isStatic: false,
                methodName: 'build',
                nameStart: 1,
                parameters: [
                    {
                        hasDefault: false,
                        name: 'label',
                        resolvableByContainer: false,
                        signatureHint: 'string',
                    },
                ],
                start: 1,
                visibility: 'public',
            },
            {
                hasDefault: false,
                name: 'label',
                resolvableByContainer: false,
                signatureHint: 'string',
            },
        )

        expect(value).toBe("'demo'")
        expect(showInputBox).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: 'Enter PHP expression for $label in ReportRunner::build(string $label)',
                title: 'To Tinker: ReportRunner::build',
            }),
        )
    })

    it('includes function context when prompting for unresolved parameters', async () => {
        const showInputBox = vi.mocked(vscode.window.showInputBox)
        showInputBox.mockResolvedValue("'demo'")

        const value = await promptForParameter(
            {
                end: 10,
                fullyQualifiedFunctionName: '\\App\\Support\\build_report',
                functionName: 'build_report',
                nameStart: 1,
                namespaceName: 'App\\Support',
                parameters: [
                    {
                        hasDefault: false,
                        name: 'label',
                        resolvableByContainer: false,
                        signatureHint: 'string',
                    },
                ],
                start: 1,
            },
            {
                hasDefault: false,
                name: 'label',
                resolvableByContainer: false,
                signatureHint: 'string',
            },
        )

        expect(value).toBe("'demo'")
        expect(showInputBox).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: 'Enter PHP expression for $label in build_report(string $label)',
                title: 'To Tinker: build_report',
            }),
        )
    })

    it('quotes raw string input for string parameters', async () => {
        const showInputBox = vi.mocked(vscode.window.showInputBox)
        showInputBox.mockResolvedValue('demo')

        const value = await promptForParameter(
            {
                end: 10,
                fullyQualifiedFunctionName: '\\App\\Support\\build_report',
                functionName: 'build_report',
                nameStart: 1,
                namespaceName: 'App\\Support',
                parameters: [],
                start: 1,
            },
            {
                hasDefault: false,
                name: 'label',
                resolvableByContainer: false,
                signatureHint: 'string',
            },
        )

        expect(value).toBe("'demo'")
    })

    it('normalizes common boolean input for bool parameters', async () => {
        const showInputBox = vi.mocked(vscode.window.showInputBox)
        showInputBox.mockResolvedValue('yes')

        const value = await promptForParameter(
            {
                end: 10,
                fullyQualifiedFunctionName: '\\App\\Support\\build_report',
                functionName: 'build_report',
                nameStart: 1,
                namespaceName: 'App\\Support',
                parameters: [],
                start: 1,
            },
            {
                hasDefault: false,
                name: 'enabled',
                resolvableByContainer: false,
                signatureHint: 'bool',
            },
        )

        expect(value).toBe('true')
    })

    it('accepts an executable configured php path', () => {
        const tempRoot = fs.mkdtempSync(
            path.join(os.tmpdir(), 'to-tinker-php-'),
        )
        const phpBinary = path.join(tempRoot, 'php')
        fs.writeFileSync(phpBinary, '#!/bin/sh\n')
        fs.chmodSync(phpBinary, 0o755)

        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) =>
                key === 'phpPath' ? phpBinary : defaultValue,
        } as ReturnType<typeof vscode.workspace.getConfiguration>)

        expect(resolvePhpExecutable()).toBe(phpBinary)

        fs.rmSync(tempRoot, { force: true, recursive: true })
    })
})
