import type { RunMode } from '../../commands'
import type { LaravelWorkspace } from '../../workspace'
import type { FunctionInfo, MethodInfo } from '../discovery/callable-discovery'
import type { RunPlan } from './run-plan'

export interface PreparedExecution {
    callableFunction?: FunctionInfo
    method?: MethodInfo
    payload: string
    plan: RunPlan
}

export interface ExecutionRequest {
    workspace: LaravelWorkspace
    phpExecutable: string
    mode: RunMode
    payload: string
    filePath: string
    sandboxEnabled: boolean
    sourceCode?: string
    displaySourceCode?: string
    sourceLineStart?: number
    sourceLineEnd?: number
    method?: MethodInfo
    callableFunction?: FunctionInfo
}

export interface ExecutionResult {
    stdout: string
    stderr: string
    timedOut: boolean
}
