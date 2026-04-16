import type * as vscode from 'vscode'
import { resolvePhpExecutable } from '../../php'
import { type LaravelWorkspace, resolveLaravelWorkspace } from '../../workspace'
import { validateRunnableDocument } from './validate-runnable-document'

export interface ExecutionEnvironment {
    phpExecutable: string
    workspace: LaravelWorkspace
}

export function resolveExecutionEnvironment(
    document: vscode.TextDocument,
): ExecutionEnvironment {
    validateRunnableDocument(document)

    return {
        phpExecutable: resolvePhpForRun(),
        workspace: resolveWorkspaceForRun(document),
    }
}

function resolveWorkspaceForRun(
    document: vscode.TextDocument,
): LaravelWorkspace {
    return resolveLaravelWorkspace(document)
}

function resolvePhpForRun(): string {
    return resolvePhpExecutable()
}
