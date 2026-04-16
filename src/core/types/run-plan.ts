import type { RunMode } from '../../commands'
import type { FunctionInfo, MethodInfo } from '../discovery/callable-discovery'

interface BaseRunPlan {
    mode: RunMode
    sourceCode?: string
    sourceLineStart?: number
    sourceLineEnd?: number
}

export interface EvalRunPlan extends BaseRunPlan {
    strategy: 'eval'
    mode: 'selection' | 'file' | 'line'
    smartCapture: boolean
}

export interface MethodRunPlan extends BaseRunPlan {
    strategy: 'method'
    mode: 'method'
    method: MethodInfo
}

export interface FunctionRunPlan extends BaseRunPlan {
    strategy: 'function'
    mode: 'function'
    callableFunction: FunctionInfo
    functionDeclarationSource?: string
}

export type RunPlan = EvalRunPlan | MethodRunPlan | FunctionRunPlan
