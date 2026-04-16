import type { FunctionInfo, MethodInfo } from '../discovery/callable-discovery'
import type { PromptForParameter } from './prompt-adapter'

export async function resolveMethodArguments(
    method: MethodInfo,
    promptForParameter: PromptForParameter,
): Promise<Record<number, string>> {
    const argumentsList: Record<number, string> = {}

    for (const [index, parameter] of method.parameters.entries()) {
        if (parameter.resolvableByContainer || parameter.hasDefault) {
            continue
        }

        argumentsList[index] = await promptForParameter(method, parameter)
    }

    return argumentsList
}

export async function resolveFunctionArguments(
    callableFunction: FunctionInfo,
    promptForParameter: PromptForParameter,
): Promise<Record<number, string>> {
    const argumentsList: Record<number, string> = {}

    for (const [index, parameter] of callableFunction.parameters.entries()) {
        if (parameter.hasDefault) {
            continue
        }

        argumentsList[index] = await promptForParameter(
            callableFunction,
            parameter,
        )
    }

    return argumentsList
}
