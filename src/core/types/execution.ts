import type { FunctionInfo, MethodInfo } from '../discovery/callable-discovery'
import type { RunPlan } from './run-plan'

export interface PreparedExecution {
    callableFunction?: FunctionInfo
    method?: MethodInfo
    payload: string
    plan: RunPlan
}
