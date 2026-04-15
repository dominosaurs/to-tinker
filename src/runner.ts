import { type ChildProcess, spawn } from 'node:child_process'
import * as vscode from 'vscode'
import { stripAnsi } from './ansi'
import type { RunKind } from './commands'
import { getConfig } from './config'
import type { MethodInfo } from './extraction'
import type { Output, RunSummary } from './output'
import { resolvePhpExecutable } from './php'
import type { LaravelWorkspace } from './workspace'

export interface ExecutionRequest {
    workspace: LaravelWorkspace
    kind: RunKind
    payload: string
    filePath: string
    sandboxEnabled: boolean
    method?: MethodInfo
}

export interface ExecutionResult {
    stdout: string
    stderr: string
    timedOut: boolean
}

export class RunRegistry {
    private readonly activeRoots = new Map<string, ChildProcess>()

    has(rootPath: string): boolean {
        return this.activeRoots.has(rootPath)
    }

    start(rootPath: string, process: ChildProcess): void {
        this.activeRoots.set(rootPath, process)
    }

    end(rootPath: string): void {
        this.activeRoots.delete(rootPath)
    }

    killAll(): void {
        for (const process of this.activeRoots.values()) {
            process.kill('SIGKILL')
        }

        this.activeRoots.clear()
    }
}

export async function executeTinker(
    request: ExecutionRequest,
    output: Output,
    registry: RunRegistry,
): Promise<ExecutionResult> {
    if (registry.has(request.workspace.rootPath)) {
        throw new Error(
            `A To-Tinker run is already active for ${request.workspace.rootPath}.`,
        )
    }

    const config = getConfig()
    const phpExecutable = resolvePhpExecutable()
    const timeoutMs = config.timeoutSeconds * 1000
    await output.show({
        diagnostics: `root=${request.workspace.rootPath}`,
        status: 'running',
        summary: buildSummary(request),
    })

    return await new Promise<ExecutionResult>((resolve, reject) => {
        const child = spawn(
            phpExecutable,
            [request.workspace.artisanPath, 'tinker'],
            {
                cwd: request.workspace.rootPath,
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe'],
            },
        )

        registry.start(request.workspace.rootPath, child)

        let stdout = ''
        let stderr = ''
        let timedOut = false
        let finished = false

        const complete = (handler: () => void): void => {
            if (finished) {
                return
            }

            finished = true
            clearTimeout(timeoutHandle)
            registry.end(request.workspace.rootPath)
            handler()
        }

        const timeoutHandle = setTimeout(() => {
            timedOut = true
            child.kill('SIGKILL')
        }, timeoutMs)

        child.stdout.on('data', (chunk: Buffer | string) => {
            stdout += chunk.toString()
        })

        child.stderr.on('data', (chunk: Buffer | string) => {
            stderr += chunk.toString()
        })

        child.on('error', error => {
            complete(() => reject(error))
        })

        child.on('close', () => {
            complete(() =>
                resolve({
                    stderr: stripAnsi(stderr),
                    stdout: stripAnsi(stdout),
                    timedOut,
                }),
            )
        })

        child.stdin.write(request.payload)
        child.stdin.end()
    })
}

export async function renderExecutionReport(
    request: ExecutionRequest,
    result: ExecutionResult,
    output: Output,
): Promise<void> {
    const summary = buildSummary(request)

    if (result.timedOut) {
        await output.show({
            diagnostics: normalizeDiagnostics(result.stderr),
            error: 'Execution timed out.',
            status: 'timeout',
            summary,
        })
        void vscode.window.showErrorMessage(
            `To-Tinker run timed out after ${getConfig().timeoutSeconds} seconds.`,
        )
        return
    }

    const stdout = result.stdout
    const resultMarker = '__TO_TINKER_RESULT__\n'
    const errorMarker = '__TO_TINKER_ERROR__\n'
    const diagnosticsMarker = '\n__TO_TINKER_DIAGNOSTICS__\n'

    if (stdout.includes(errorMarker)) {
        const [errorBody = '', diagnosticsBody = ''] =
            stdout.split(errorMarker)[1]?.split(diagnosticsMarker) ?? []
        await output.show({
            diagnostics: normalizeDiagnostics(
                [diagnosticsBody, result.stderr].join('\n'),
            ),
            error: errorBody.trim() || 'Execution failed.',
            status: 'error',
            summary,
        })
        void vscode.window.showErrorMessage(
            'To-Tinker execution failed. See output channel.',
        )
        return
    }

    if (!stdout.includes(resultMarker)) {
        await output.show({
            diagnostics: normalizeDiagnostics(result.stderr),
            result: stdout.trim() || 'null',
            status: 'success',
            summary,
        })
        return
    }

    const [resultBody = '', diagnosticsBody = ''] =
        stdout.split(resultMarker)[1]?.split(diagnosticsMarker) ?? []
    await output.show({
        diagnostics: normalizeDiagnostics(
            [diagnosticsBody, result.stderr].join('\n'),
        ),
        result: resultBody.trim() || 'null',
        status: 'success',
        summary,
    })
}

function normalizeDiagnostics(value: string): string {
    const text = value.trim()
    return text || 'none'
}

function buildSummary(request: ExecutionRequest): RunSummary {
    return {
        className: request.method?.className,
        filePath: request.filePath,
        kind: request.kind,
        methodName: request.method?.methodName,
        rootPath: request.workspace.rootPath,
        sandboxEnabled: request.sandboxEnabled,
    }
}
