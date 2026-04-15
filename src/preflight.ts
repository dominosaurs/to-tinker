import type * as vscode from 'vscode'
import { resolvePhpExecutable } from './php'
import { type LaravelWorkspace, resolveLaravelWorkspace } from './workspace'

export interface ExecutionEnvironment {
    phpExecutable: string
    workspace: LaravelWorkspace
}

export function prepareExecutionEnvironment(
    document: vscode.TextDocument,
): ExecutionEnvironment {
    const workspace = resolveLaravelWorkspace(document)
    const phpExecutable = resolvePhpExecutable()

    return {
        phpExecutable,
        workspace,
    }
}
