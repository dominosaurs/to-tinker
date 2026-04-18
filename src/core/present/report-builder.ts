import { existsSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import { getConfig } from '../../config'
import type { RunSummary } from '../../result-view-types'
import type { ExecutionRequest, ExecutionResult } from '../types/execution'
import type { BuiltRunReport } from '../types/report'

const RESULT_MARKER = '__TO_TINKER_RESULT__\n'
const ERROR_MARKER = '__TO_TINKER_ERROR__\n'
const META_MARKER = '\n__TO_TINKER_META__\n'
const DIAGNOSTICS_MARKER = '\n__TO_TINKER_DIAGNOSTICS__\n'

interface OutputMetadata {
    type?: string
    class?: string | null
}

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
                error: sanitizeRenderedOutput(errorBody) || 'Execution failed.',
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
                result: sanitizeRenderedOutput(stdout) || 'null',
                status: 'success',
                summary,
            },
        }
    }

    const [resultBody = '', metadataBody = '', diagnosticsBody = ''] =
        splitResultMetadataAndDiagnostics(stdout)

    const outputMetadata = parseOutputMetadata(metadataBody)

    return {
        report: {
            diagnostics: normalizeDiagnostics(
                [diagnosticsBody, result.stderr].join('\n'),
            ),
            result: sanitizeRenderedOutput(resultBody) || 'null',
            status: 'success',
            summary: buildSummary(request, outputMetadata),
        },
    }
}

function splitResultMetadataAndDiagnostics(
    stdout: string,
): [string, string, string] {
    const [resultSegment = '', diagnosticsBody = ''] =
        stdout.split(RESULT_MARKER)[1]?.split(DIAGNOSTICS_MARKER) ?? []

    const [resultBody = '', metadataBody = ''] =
        resultSegment.split(META_MARKER) ?? []

    return [resultBody, metadataBody, diagnosticsBody]
}

function parseOutputMetadata(value: string): OutputMetadata | undefined {
    const text = value.trim()
    if (!text) {
        return undefined
    }

    try {
        return JSON.parse(text) as OutputMetadata
    } catch {
        return undefined
    }
}

function normalizeDiagnostics(value: string): string {
    const text = value.trim()
    return text || 'none'
}

function sanitizeRenderedOutput(value: string): string {
    const sanitized = value
        .replace(
            /^\[!\]\s+Aliasing\s+'.*?'\s+to\s+'.*?'\s+for\s+this\s+Tinker\s+session\.\n?/gmu,
            '',
        )
        .replace(
            /\s*\/\/\s+vendor\/psy\/psysh\/src\/ExecutionClosure\.php\(\d+\)\s+:\s+eval\(\)'d code(?:\(\d+\)\s+:\s+eval\(\)'d code)*:\d+/gu,
            '',
        )
        .trim()

    return stripTrailingDuplicateDumpClassLine(sanitized)
}

function stripTrailingDuplicateDumpClassLine(value: string): string {
    const lines = value.split('\n')
    if (lines.length < 2) {
        return value
    }

    const firstLine = lines[0]?.trim()
    const lastLine = lines.at(-1)?.trim()
    const firstClassName = firstLine?.match(
        /^([A-Z_a-z\\][\w\\]*)\s+\{#\d+/u,
    )?.[1]

    if (!firstClassName || !lastLine || lastLine !== firstClassName) {
        return value
    }

    return lines.slice(0, -1).join('\n').trimEnd()
}

function buildSummary(
    request: ExecutionRequest,
    outputMetadata?: OutputMetadata,
): RunSummary {
    const outputTypeLabel = resolveOutputTypeLabel(outputMetadata)

    return {
        className: request.method?.className,
        displaySourceCode: request.displaySourceCode,
        filePath: request.filePath,
        functionName: request.callableFunction?.functionName,
        methodName: request.method?.methodName,
        mode: request.mode,
        outputDocUrl: resolveOutputDocUrl(
            outputTypeLabel,
            request.workspace.rootPath,
        ),
        outputLocalFile: resolveOutputLocalFile(
            request.workspace.rootPath,
            outputTypeLabel,
        ),
        outputTypeLabel,
        phpExecutable: request.phpExecutable,
        rootPath: request.workspace.rootPath,
        sandboxEnabled: request.sandboxEnabled,
        sourceCode: request.sourceCode,
        sourceLineEnd: request.sourceLineEnd,
        sourceLineStart: request.sourceLineStart,
    }
}

function resolveOutputTypeLabel(
    outputMetadata?: OutputMetadata,
): string | undefined {
    return outputMetadata?.class ?? outputMetadata?.type ?? undefined
}

function resolveOutputDocUrl(
    typeLabel: string | undefined,
    rootPath: string,
): string | undefined {
    if (!typeLabel || typeLabel === 'null') {
        return undefined
    }

    if (PHP_DOC_TYPES.has(typeLabel)) {
        return `https://www.php.net/manual/en/language.types.${PHP_DOC_TYPE_PATHS[typeLabel]}.php`
    }

    if (typeLabel.startsWith('Illuminate\\')) {
        return `https://api.laravel.com/docs/${resolveLaravelDocsVersion(rootPath)}/${typeLabel.replaceAll('\\', '/')}.html`
    }

    return undefined
}

function resolveOutputLocalFile(
    rootPath: string,
    typeLabel?: string,
): string | undefined {
    if (!typeLabel?.startsWith('App\\')) {
        return undefined
    }

    const candidate = `${path.join(
        rootPath,
        'app',
        ...typeLabel.slice('App\\'.length).split('\\').filter(Boolean),
    )}.php`

    return existsSync(candidate) ? candidate : undefined
}

function resolveLaravelDocsVersion(rootPath: string): string {
    return (
        readLaravelVersionFromComposerLock(rootPath) ??
        readLaravelVersionFromComposerJson(rootPath) ??
        '12.x'
    )
}

function readLaravelVersionFromComposerLock(
    rootPath: string,
): string | undefined {
    const composerLockPath = path.join(rootPath, 'composer.lock')
    if (!existsSync(composerLockPath)) {
        return undefined
    }

    try {
        const composerLock = JSON.parse(
            readFileSync(composerLockPath, 'utf8'),
        ) as {
            packages?: Array<{ name?: string; version?: string }>
        }
        const frameworkPackage = composerLock.packages?.find(
            pkg => pkg.name === 'laravel/framework',
        )

        return normalizeLaravelVersion(frameworkPackage?.version)
    } catch {
        return undefined
    }
}

function readLaravelVersionFromComposerJson(
    rootPath: string,
): string | undefined {
    const composerJsonPath = path.join(rootPath, 'composer.json')
    if (!existsSync(composerJsonPath)) {
        return undefined
    }

    try {
        const composerJson = JSON.parse(
            readFileSync(composerJsonPath, 'utf8'),
        ) as {
            require?: Record<string, string>
            'require-dev'?: Record<string, string>
        }
        const versionConstraint =
            composerJson.require?.['laravel/framework'] ??
            composerJson['require-dev']?.['laravel/framework']

        return normalizeLaravelVersion(versionConstraint)
    } catch {
        return undefined
    }
}

function normalizeLaravelVersion(value?: string): string | undefined {
    const major = value?.match(/\d+/)?.[0]
    return major ? `${major}.x` : undefined
}

const PHP_DOC_TYPES = new Set([
    'array',
    'bool',
    'callable',
    'float',
    'int',
    'iterable',
    'object',
    'string',
])

const PHP_DOC_TYPE_PATHS: Record<string, string> = {
    array: 'array',
    bool: 'boolean',
    callable: 'callable',
    float: 'float',
    int: 'integer',
    iterable: 'iterable',
    object: 'object',
    string: 'string',
}
