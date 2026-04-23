import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { getConfig } from './config'
import type { Log } from './log'
import { resolvePhpExecutable } from './php'
import { resolveLaravelWorkspace } from './workspace'
import { buildTinkerPayload } from './wrapper'

interface DoctorCheck {
    detail: string
    name: string
    status: 'pass' | 'fail' | 'warn'
}

interface ProcessCheckResult {
    code: number | null
    durationMs: number
    errorMessage: string | null
    signal: NodeJS.Signals | null
    stderr: string
    stdout: string
    timedOut: boolean
}

export async function runDoctor(log: Log): Promise<void> {
    log.show()
    log.info('doctor start')

    const checks: DoctorCheck[] = []
    const config = getConfig()
    checks.push({
        detail: `timeoutSeconds=${config.timeoutSeconds}, dryRun=${config.sandbox.defaultEnabled ? 'on' : 'off'}`,
        name: 'config',
        status: config.timeoutSeconds < 3 ? 'warn' : 'pass',
    })

    const workspaceResult = resolveWorkspaceForDoctor()
    checks.push(workspaceResult.check)

    const phpResult = resolvePhpForDoctor()
    checks.push(phpResult.check)

    if (phpResult.phpExecutable) {
        checks.push(
            toCheck(
                'php -v',
                await runProcessCheck(phpResult.phpExecutable, ['-v']),
            ),
        )
    }

    if (phpResult.phpExecutable && workspaceResult.workspace) {
        const artisanVersionResult = await runProcessCheck(
            phpResult.phpExecutable,
            [workspaceResult.workspace.artisanPath, '--version'],
            workspaceResult.workspace.rootPath,
        )
        checks.push(toCheck('artisan --version', artisanVersionResult))

        const artisanPingResult = await runProcessCheck(
            phpResult.phpExecutable,
            [
                workspaceResult.workspace.artisanPath,
                'tinker',
                '--no-ansi',
                '--execute',
                'echo "__TO_TINKER_DOCTOR_OK__";',
            ],
            workspaceResult.workspace.rootPath,
            config.timeoutSeconds * 1000,
        )
        checks.push(
            toCheckExpectingMarker(
                'artisan tinker ping',
                artisanPingResult,
                '__TO_TINKER_DOCTOR_OK__',
            ),
        )

        const wrapperProbeSource = 'return "__TO_TINKER_DOCTOR_WRAPPED_OK__";'
        const wrappedPayloadWithoutDryRun = buildTinkerPayload({
            fakeStorage: config.sandbox.fakeStorage,
            filePath: workspaceResult.workspace.artisanPath,
            preparedUserCode: wrapperProbeSource,
            sandboxEnabled: false,
        })
        const wrappedWithoutDryRunResult = await runProcessCheck(
            phpResult.phpExecutable,
            [
                workspaceResult.workspace.artisanPath,
                'tinker',
                '--no-ansi',
                '--execute',
                wrappedPayloadWithoutDryRun,
            ],
            workspaceResult.workspace.rootPath,
            config.timeoutSeconds * 1000,
        )
        checks.push(
            toCheckExpectingMarker(
                'toTinker wrapped probe (dryRun=off)',
                wrappedWithoutDryRunResult,
                '__TO_TINKER_RESULT__',
            ),
        )

        const wrappedPayloadWithDryRun = buildTinkerPayload({
            fakeStorage: config.sandbox.fakeStorage,
            filePath: workspaceResult.workspace.artisanPath,
            preparedUserCode: wrapperProbeSource,
            sandboxEnabled: true,
        })
        const wrappedWithDryRunResult = await runProcessCheck(
            phpResult.phpExecutable,
            [
                workspaceResult.workspace.artisanPath,
                'tinker',
                '--no-ansi',
                '--execute',
                wrappedPayloadWithDryRun,
            ],
            workspaceResult.workspace.rootPath,
            config.timeoutSeconds * 1000,
        )
        checks.push(
            toCheckExpectingMarker(
                'toTinker wrapped probe (dryRun=on)',
                wrappedWithDryRunResult,
                '__TO_TINKER_RESULT__',
            ),
        )

        if (
            !artisanPingResult.timedOut &&
            !wrappedWithoutDryRunResult.timedOut &&
            wrappedWithDryRunResult.timedOut
        ) {
            checks.push({
                detail: 'Dry Run prelude likely hangs while opening at least one DB connection. Make unreachable connections optional in your Laravel database config.',
                name: 'diagnosis',
                status: 'warn',
            })
        }
    }

    for (const check of checks) {
        log.info(
            `doctor ${check.status.toUpperCase()} ${check.name}: ${check.detail}`,
        )
    }

    const failed = checks.filter(check => check.status === 'fail')
    const warned = checks.filter(check => check.status === 'warn')
    const summary = `Doctor finished: ${checks.length - failed.length}/${checks.length} checks passed.`
    log.info(summary)

    if (failed.length > 0) {
        void vscode.window.showErrorMessage(
            `${summary} Open "To Tinker Logs" for details.`,
        )
        return
    }

    if (warned.length > 0) {
        void vscode.window.showWarningMessage(
            `${summary} ${warned.length} warning(s) found. Open "To Tinker Logs" for details.`,
        )
        return
    }

    void vscode.window.showInformationMessage(summary)
}

function resolveWorkspaceForDoctor(): {
    check: DoctorCheck
    workspace:
        | {
              artisanPath: string
              rootPath: string
          }
        | undefined
} {
    const activeDocument = vscode.window.activeTextEditor?.document
    if (activeDocument && activeDocument.languageId === 'php') {
        try {
            const workspace = resolveLaravelWorkspace(activeDocument)
            return {
                check: {
                    detail: `root=${workspace.rootPath}, artisan=${workspace.artisanPath}`,
                    name: 'workspace',
                    status: 'pass',
                },
                workspace,
            }
        } catch (error) {
            return {
                check: {
                    detail:
                        error instanceof Error ? error.message : String(error),
                    name: 'workspace',
                    status: 'fail',
                },
                workspace: undefined,
            }
        }
    }

    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const artisanPath = path.join(folder.uri.fsPath, 'artisan')
        if (fs.existsSync(artisanPath)) {
            return {
                check: {
                    detail: `root=${folder.uri.fsPath}, artisan=${artisanPath}`,
                    name: 'workspace',
                    status: 'pass',
                },
                workspace: { artisanPath, rootPath: folder.uri.fsPath },
            }
        }
    }

    return {
        check: {
            detail: 'No Laravel workspace found (missing artisan).',
            name: 'workspace',
            status: 'fail',
        },
        workspace: undefined,
    }
}

function resolvePhpForDoctor(): {
    check: DoctorCheck
    phpExecutable: string | undefined
} {
    try {
        const phpExecutable = resolvePhpExecutable()
        return {
            check: {
                detail: `php=${phpExecutable}`,
                name: 'php executable',
                status: 'pass',
            },
            phpExecutable,
        }
    } catch (error) {
        return {
            check: {
                detail: error instanceof Error ? error.message : String(error),
                name: 'php executable',
                status: 'fail',
            },
            phpExecutable: undefined,
        }
    }
}

function toCheck(name: string, result: ProcessCheckResult): DoctorCheck {
    if (result.errorMessage) {
        return {
            detail: `${result.errorMessage} (${result.durationMs}ms)`,
            name,
            status: 'fail',
        }
    }

    if (result.timedOut) {
        return {
            detail: `timed out after ${result.durationMs}ms`,
            name,
            status: 'fail',
        }
    }

    if (result.code !== 0) {
        return {
            detail: `exit code=${result.code} signal=${result.signal ?? 'none'} stderr=${summarizeOutput(result.stderr)}`,
            name,
            status: 'fail',
        }
    }

    return {
        detail: `ok (${result.durationMs}ms) stdout=${summarizeOutput(result.stdout)}`,
        name,
        status: 'pass',
    }
}

function toCheckExpectingMarker(
    name: string,
    result: ProcessCheckResult,
    marker: string,
): DoctorCheck {
    const check = toCheck(name, result)
    if (check.status !== 'pass') {
        return check
    }

    if (!result.stdout.includes(marker)) {
        return {
            detail: `missing marker ${marker}, stdout=${summarizeOutput(result.stdout)}`,
            name,
            status: 'warn',
        }
    }

    return check
}

async function runProcessCheck(
    command: string,
    args: string[],
    cwd?: string,
    timeoutMs = 10_000,
): Promise<ProcessCheckResult> {
    return await new Promise<ProcessCheckResult>(resolve => {
        const startedAt = Date.now()
        const child = spawn(command, args, {
            cwd,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''
        let timedOut = false
        let finished = false

        const complete = (
            code: number | null,
            signal: NodeJS.Signals | null,
            errorMessage: string | null,
        ): void => {
            if (finished) {
                return
            }

            finished = true
            clearTimeout(timeoutHandle)
            resolve({
                code,
                durationMs: Date.now() - startedAt,
                errorMessage,
                signal,
                stderr,
                stdout,
                timedOut,
            })
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
            complete(null, null, error.message)
        })

        child.on('close', (code, signal) => {
            complete(code, signal, null)
        })
    })
}

function summarizeOutput(value: string): string {
    const compact = value.trim().replace(/\s+/g, ' ')
    if (!compact) {
        return '(empty)'
    }

    return compact.length <= 140 ? compact : `${compact.slice(0, 137)}...`
}
