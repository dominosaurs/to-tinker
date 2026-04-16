import {
    buildFunctionPayload,
    buildMethodPayload,
    buildTinkerPayload,
} from '../../wrapper'
import type { PreparedExecution } from '../types/execution'
import type { RunPlan } from '../types/run-plan'
import type { PromptForParameter } from './prompt-adapter'
import {
    resolveFunctionArguments,
    resolveMethodArguments,
} from './resolve-run-arguments'

export interface PrepareExecutionContext {
    fakeStorage: boolean
    filePath: string
    sandboxEnabled: boolean
}

export async function prepareExecution(
    plan: RunPlan,
    context: PrepareExecutionContext,
    promptForParameter: PromptForParameter,
): Promise<PreparedExecution> {
    switch (plan.strategy) {
        case 'eval':
            return {
                payload: buildTinkerPayload({
                    fakeStorage: context.fakeStorage,
                    filePath: context.filePath,
                    sandboxEnabled: context.sandboxEnabled,
                    selectionOrFileCode: plan.sourceCode,
                    smartCapture: plan.smartCapture,
                }),
                plan,
            }
        case 'method':
            return {
                method: plan.method,
                payload: buildMethodPayload({
                    fakeStorage: context.fakeStorage,
                    filePath: context.filePath,
                    method: plan.method,
                    promptedArguments: await resolveMethodArguments(
                        plan.method,
                        promptForParameter,
                    ),
                    sandboxEnabled: context.sandboxEnabled,
                }),
                plan,
            }
        case 'function':
            return {
                callableFunction: plan.callableFunction,
                payload: buildFunctionPayload({
                    callableFunction: plan.callableFunction,
                    fakeStorage: context.fakeStorage,
                    filePath: context.filePath,
                    functionDeclarationSource: plan.functionDeclarationSource,
                    promptedArguments: await resolveFunctionArguments(
                        plan.callableFunction,
                        promptForParameter,
                    ),
                    sandboxEnabled: context.sandboxEnabled,
                }),
                plan,
            }
    }
}
