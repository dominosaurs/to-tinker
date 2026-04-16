import {
    buildFunctionPayload,
    buildMethodPayload,
    buildTinkerPayload,
} from '../../wrapper'
import type { PreparedExecution } from '../types/execution'
import type { RunPlan } from '../types/run-plan'
import { prepareEvalSource } from './prepare-eval-source'
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
            if (!plan.sourceCode) {
                throw new Error('Missing eval source code.')
            }

            return {
                payload: buildTinkerPayload({
                    fakeStorage: context.fakeStorage,
                    filePath: context.filePath,
                    preparedUserCode: prepareEvalSource(
                        plan.sourceCode,
                        plan.smartCapture,
                    ),
                    sandboxEnabled: context.sandboxEnabled,
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
