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
