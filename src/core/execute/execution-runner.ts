import { spawn } from 'node:child_process'
import { stripAnsi } from '../../ansi'
import { getConfig } from '../../config'
import type { Log } from '../../log'
import type { RunRegistry } from '../../runner'
import type { ExecutionRequest, ExecutionResult } from '../types/execution'

export async function runExecutionProcess(
    request: ExecutionRequest,
    registry: RunRegistry,
    log: Log,
): Promise<ExecutionResult> {
    if (registry.has(request.workspace.rootPath)) {
        log.info(
            `run blocked: active process for ${request.workspace.rootPath}`,
        )
        throw new Error(
            `A To Tinker run is already active for ${request.workspace.rootPath}.`,
        )
    }

    const config = getConfig()
    const timeoutMs = config.timeoutSeconds * 1000
    log.info(
        `spawn start mode=${request.mode} sandbox=${request.sandboxEnabled ? 'on' : 'off'} root=${request.workspace.rootPath}`,
    )

    return await new Promise<ExecutionResult>((resolve, reject) => {
        const child = spawn(
            request.phpExecutable,
            [
                request.workspace.artisanPath,
                'tinker',
                '--no-ansi',
                '--execute',
                request.payload,
            ],
            {
                cwd: request.workspace.rootPath,
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe'],
            },
        )

        registry.start(request.workspace.rootPath, child)
        log.info(`spawned pid=${child.pid ?? 'unknown'}`)

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
            log.info(`run complete pid=${child.pid ?? 'unknown'}`)
            handler()
        }

        const timeoutHandle = setTimeout(() => {
            timedOut = true
            log.info(
                `timeout pid=${child.pid ?? 'unknown'} after ${timeoutMs}ms`,
            )
            child.kill('SIGKILL')
        }, timeoutMs)

        child.stdout.on('data', (chunk: Buffer | string) => {
            stdout += chunk.toString()
        })

        child.stderr.on('data', (chunk: Buffer | string) => {
            stderr += chunk.toString()
        })

        child.on('error', error => {
            log.info(`process error: ${error.message}`)
            complete(() => reject(error))
        })
        child.on('close', code => {
            log.info(
                `process close pid=${child.pid ?? 'unknown'} code=${code ?? 'null'} stdout=${stdout.length} stderr=${stderr.length}`,
            )
            complete(() =>
                resolve({
                    stderr: stripAnsi(stderr),
                    stdout: stripAnsi(stdout),
                    timedOut,
                }),
            )
        })
    })
}
