import * as vscode from 'vscode'
import { runExecutionProcess } from './core/execute/execution-runner'
import {
    buildExecutionReport,
    buildRunningReport,
} from './core/present/report-builder'
import type { ExecutionRequest, ExecutionResult } from './core/types/execution'
import type { Log } from './log'
import type { Output } from './output'

export class RunRegistry {
    private readonly activeRoots = new Map<
        string,
        import('node:child_process').ChildProcess
    >()

    has(rootPath: string): boolean {
        return this.activeRoots.has(rootPath)
    }

    start(
        rootPath: string,
        process: import('node:child_process').ChildProcess,
    ): void {
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
    log: Log,
): Promise<ExecutionResult> {
    await output.show(buildRunningReport(request))
    return await runExecutionProcess(request, registry, log)
}

export async function renderExecutionReport(
    request: ExecutionRequest,
    result: ExecutionResult,
    output: Output,
): Promise<void> {
    const built = buildExecutionReport(request, result)
    await output.show(built.report)
    if (built.userMessage) {
        void vscode.window.showErrorMessage(built.userMessage)
    }
}
