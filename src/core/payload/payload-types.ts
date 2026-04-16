import type { FunctionInfo, MethodInfo } from '../../extraction'

export interface PayloadBuildOptions {
    sandboxEnabled: boolean
    fakeStorage: boolean
    filePath: string
    method?: MethodInfo
    callableFunction?: FunctionInfo
    functionDeclarationSource?: string
    smartCapture?: boolean
    selectionOrFileCode?: string
    promptedArguments?: Record<number, string>
}
