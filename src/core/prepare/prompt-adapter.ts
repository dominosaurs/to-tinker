import type {
    FunctionInfo,
    MethodInfo,
    MethodParameter,
} from '../discovery/callable-discovery'

export type PromptForParameter = (
    callable: MethodInfo | FunctionInfo,
    parameter: MethodParameter,
) => Promise<string>
