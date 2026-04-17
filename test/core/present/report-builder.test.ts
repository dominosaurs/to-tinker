import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import { buildExecutionReport } from '../../../src/core/present/report-builder'
import type {
    ExecutionRequest,
    ExecutionResult,
} from '../../../src/core/types/execution'

function createRequest(): ExecutionRequest {
    return {
        filePath: '/workspace/demo.php',
        mode: 'selection',
        payload: 'payload',
        phpExecutable: '/usr/bin/php',
        sandboxEnabled: true,
        sourceCode: '$value;',
        sourceLineEnd: 1,
        sourceLineStart: 1,
        workspace: {
            artisanPath: '/workspace/artisan',
            rootPath: '/workspace',
            workspaceFolder: {
                index: 0,
                name: 'demo',
                uri: vscode.Uri.file('/workspace'),
            },
        },
    }
}

describe('report builder', () => {
    it('builds a timeout report with a user message', () => {
        const result: ExecutionResult = {
            stderr: 'slow',
            stdout: '',
            timedOut: true,
        }

        const built = buildExecutionReport(createRequest(), result)

        expect(built.report.status).toBe('timeout')
        expect(built.report.error).toContain('timed out')
        expect(built.userMessage).toContain('timed out')
    })

    it('builds an error report from marked stdout', () => {
        const result: ExecutionResult = {
            stderr: '',
            stdout: '__TO_TINKER_ERROR__\nBoom\n__TO_TINKER_DIAGNOSTICS__\nelapsed_ms=2\n',
            timedOut: false,
        }

        const built = buildExecutionReport(createRequest(), result)

        expect(built.report.status).toBe('error')
        expect(built.report.error).toBe('Boom')
        expect(built.report.diagnostics).toContain('elapsed_ms=2')
        expect(built.userMessage).toContain('execution failed')
    })

    it('builds a success report from marked stdout', () => {
        const result: ExecutionResult = {
            stderr: '',
            stdout: '__TO_TINKER_RESULT__\n42\n__TO_TINKER_DIAGNOSTICS__\nelapsed_ms=1\n',
            timedOut: false,
        }

        const built = buildExecutionReport(createRequest(), result)

        expect(built.report.status).toBe('success')
        expect(built.report.result).toBe('42')
        expect(built.report.diagnostics).toContain('elapsed_ms=1')
        expect(built.userMessage).toBeUndefined()
    })

    it('maps builtin output types to PHP docs', () => {
        const result: ExecutionResult = {
            stderr: '',
            stdout: '__TO_TINKER_RESULT__\ntrue\n__TO_TINKER_META__\n{"type":"bool","class":null}\n__TO_TINKER_DIAGNOSTICS__\nelapsed_ms=1\n',
            timedOut: false,
        }

        const built = buildExecutionReport(createRequest(), result)

        expect(built.report.summary.outputTypeLabel).toBe('bool')
        expect(built.report.summary.outputDocUrl).toBe(
            'https://www.php.net/manual/en/language.types.boolean.php',
        )
        expect(built.report.summary.outputLocalFile).toBeUndefined()
    })

    it('maps Illuminate classes to Laravel API docs using detected composer.lock version', () => {
        const rootPath = mkdtempSync(path.join(tmpdir(), 'to-tinker-'))
        const baseRequest = createRequest()
        const request = {
            ...baseRequest,
            workspace: {
                ...baseRequest.workspace,
                rootPath,
                workspaceFolder: {
                    ...baseRequest.workspace.workspaceFolder,
                    uri: vscode.Uri.file(rootPath),
                },
            },
        }
        writeFileSync(
            path.join(rootPath, 'composer.lock'),
            JSON.stringify({
                packages: [
                    {
                        name: 'laravel/framework',
                        version: 'v11.32.0',
                    },
                ],
            }),
        )

        try {
            const result: ExecutionResult = {
                stderr: '',
                stdout: '__TO_TINKER_RESULT__\n{}\n__TO_TINKER_META__\n{"type":"Illuminate\\\\Support\\\\Collection","class":"Illuminate\\\\Support\\\\Collection"}\n__TO_TINKER_DIAGNOSTICS__\nelapsed_ms=1\n',
                timedOut: false,
            }

            const built = buildExecutionReport(request, result)

            expect(built.report.summary.outputTypeLabel).toBe(
                'Illuminate\\Support\\Collection',
            )
            expect(built.report.summary.outputDocUrl).toBe(
                'https://api.laravel.com/docs/11.x/Illuminate/Support/Collection.html',
            )
        } finally {
            rmSync(rootPath, {
                force: true,
                recursive: true,
            })
        }
    })

    it('maps App classes to local files when the file exists', () => {
        const rootPath = mkdtempSync(path.join(tmpdir(), 'to-tinker-'))
        const baseRequest = createRequest()
        const request = {
            ...baseRequest,
            workspace: {
                ...baseRequest.workspace,
                rootPath,
                workspaceFolder: {
                    ...baseRequest.workspace.workspaceFolder,
                    uri: vscode.Uri.file(rootPath),
                },
            },
        }
        const userModelPath = path.join(rootPath, 'app', 'Models', 'User.php')
        mkdirSync(path.dirname(userModelPath), { recursive: true })
        writeFileSync(userModelPath, '<?php')

        try {
            const result: ExecutionResult = {
                stderr: '',
                stdout: '__TO_TINKER_RESULT__\n{}\n__TO_TINKER_META__\n{"type":"App\\\\Models\\\\User","class":"App\\\\Models\\\\User"}\n__TO_TINKER_DIAGNOSTICS__\nelapsed_ms=1\n',
                timedOut: false,
            }

            const built = buildExecutionReport(request, result)

            expect(built.report.summary.outputTypeLabel).toBe(
                'App\\Models\\User',
            )
            expect(built.report.summary.outputDocUrl).toBeUndefined()
            expect(built.report.summary.outputLocalFile).toBe(userModelPath)
        } finally {
            rmSync(rootPath, {
                force: true,
                recursive: true,
            })
        }
    })

    it('falls back to composer.json when composer.lock is missing', () => {
        const rootPath = mkdtempSync(path.join(tmpdir(), 'to-tinker-'))
        const baseRequest = createRequest()
        const request = {
            ...baseRequest,
            workspace: {
                ...baseRequest.workspace,
                rootPath,
                workspaceFolder: {
                    ...baseRequest.workspace.workspaceFolder,
                    uri: vscode.Uri.file(rootPath),
                },
            },
        }
        writeFileSync(
            path.join(rootPath, 'composer.json'),
            JSON.stringify({
                require: {
                    'laravel/framework': '^10.48',
                },
            }),
        )

        try {
            const result: ExecutionResult = {
                stderr: '',
                stdout: '__TO_TINKER_RESULT__\n{}\n__TO_TINKER_META__\n{"type":"Illuminate\\\\Database\\\\Eloquent\\\\Builder","class":"Illuminate\\\\Database\\\\Eloquent\\\\Builder"}\n__TO_TINKER_DIAGNOSTICS__\nelapsed_ms=1\n',
                timedOut: false,
            }

            const built = buildExecutionReport(request, result)

            expect(built.report.summary.outputDocUrl).toBe(
                'https://api.laravel.com/docs/10.x/Illuminate/Database/Eloquent/Builder.html',
            )
        } finally {
            rmSync(rootPath, {
                force: true,
                recursive: true,
            })
        }
    })

    it('strips Tinker alias headers and PsySH eval footers from success output', () => {
        const result: ExecutionResult = {
            stderr: '',
            stdout: `__TO_TINKER_RESULT__
[!] Aliasing 'User' to 'App\\Models\\User' for this Tinker session.
Illuminate\\Database\\Eloquent\\Builder {#7622
} // vendor/psy/psysh/src/ExecutionClosure.php(41) : eval()'d code(34) : eval()'d code:1
__TO_TINKER_DIAGNOSTICS__
elapsed_ms=1
`,
            timedOut: false,
        }

        const built = buildExecutionReport(createRequest(), result)

        expect(built.report.result).toBe(
            'Illuminate\\Database\\Eloquent\\Builder {#7622\n}',
        )
    })

    it('strips trailing duplicate dump class summary lines', () => {
        const result: ExecutionResult = {
            stderr: '',
            stdout: `__TO_TINKER_RESULT__
Illuminate\\Database\\Eloquent\\Builder {#7622
}
Illuminate\\Database\\Eloquent\\Builder
__TO_TINKER_DIAGNOSTICS__
elapsed_ms=1
`,
            timedOut: false,
        }

        const built = buildExecutionReport(createRequest(), result)

        expect(built.report.result).toBe(
            'Illuminate\\Database\\Eloquent\\Builder {#7622\n}',
        )
    })

    it('strips PsySH eval footers from error output', () => {
        const result: ExecutionResult = {
            stderr: '',
            stdout: `__TO_TINKER_ERROR__
Boom // vendor/psy/psysh/src/ExecutionClosure.php(41) : eval()'d code(34) : eval()'d code:1
__TO_TINKER_DIAGNOSTICS__
elapsed_ms=2
`,
            timedOut: false,
        }

        const built = buildExecutionReport(createRequest(), result)

        expect(built.report.error).toBe('Boom')
    })
})
