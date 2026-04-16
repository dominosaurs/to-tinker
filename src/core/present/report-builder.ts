import { getConfig } from '../../config'
import type { RunSummary } from '../../output'
import type { ExecutionRequest, ExecutionResult } from '../types/execution'
import type { BuiltRunReport } from '../types/report'

const RESULT_MARKER = '__TO_TINKER_RESULT__\n'
const ERROR_MARKER = '__TO_TINKER_ERROR__\n'
const DIAGNOSTICS_MARKER = '\n__TO_TINKER_DIAGNOSTICS__\n'

export function buildRunningReport(request: ExecutionRequest) {
    return {
        diagnostics: `root=${request.workspace.rootPath}`,
        status: 'running' as const,
        summary: buildSummary(request),
    }
}

export function buildExecutionReport(
    request: ExecutionRequest,
    result: ExecutionResult,
): BuiltRunReport {
    const summary = buildSummary(request)

    if (result.timedOut) {
        return {
            report: {
                diagnostics: normalizeDiagnostics(result.stderr),
                error: 'Execution timed out before Laravel Tinker returned a result.',
                status: 'timeout',
                summary,
            },
            userMessage: `To Tinker run timed out after ${getConfig().timeoutSeconds} seconds.`,
        }
    }

    const stdout = result.stdout
    if (stdout.includes(ERROR_MARKER)) {
        const [errorBody = '', diagnosticsBody = ''] =
            stdout.split(ERROR_MARKER)[1]?.split(DIAGNOSTICS_MARKER) ?? []

        return {
            report: {
                diagnostics: normalizeDiagnostics(
                    [diagnosticsBody, result.stderr].join('\n'),
                ),
                error: errorBody.trim() || 'Execution failed.',
                status: 'error',
                summary,
            },
            userMessage: 'To Tinker execution failed. See output channel.',
        }
    }

    if (!stdout.includes(RESULT_MARKER)) {
        return {
            report: {
                diagnostics: normalizeDiagnostics(result.stderr),
                result: stdout.trim() || 'null',
                status: 'success',
                summary,
            },
        }
    }

    const [resultBody = '', diagnosticsBody = ''] =
        stdout.split(RESULT_MARKER)[1]?.split(DIAGNOSTICS_MARKER) ?? []

    return {
        report: {
            diagnostics: normalizeDiagnostics(
                [diagnosticsBody, result.stderr].join('\n'),
            ),
            result: resultBody.trim() || 'null',
            status: 'success',
            summary,
        },
    }
}

function normalizeDiagnostics(value: string): string {
    const text = value.trim()
    return text || 'none'
}

function buildSummary(request: ExecutionRequest): RunSummary {
    return {
        className: request.method?.className,
        filePath: request.filePath,
        functionName: request.callableFunction?.functionName,
        methodName: request.method?.methodName,
        mode: request.mode,
        phpExecutable: request.phpExecutable,
        rootPath: request.workspace.rootPath,
        sandboxEnabled: request.sandboxEnabled,
        sourceCode: request.sourceCode,
        sourceLineEnd: request.sourceLineEnd,
        sourceLineStart: request.sourceLineStart,
    }
}
