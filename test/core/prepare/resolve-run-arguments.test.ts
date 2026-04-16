import { describe, expect, it, vi } from 'vitest'
import type {
    FunctionInfo,
    MethodInfo,
} from '../../../src/core/discovery/callable-discovery'
import {
    resolveFunctionArguments,
    resolveMethodArguments,
} from '../../../src/core/prepare/resolve-run-arguments'

describe('resolve run arguments', () => {
    it('prompts only unresolved method parameters', async () => {
        const prompt = vi.fn(async () => "'value'")
        const method: MethodInfo = {
            className: 'Runner',
            end: 10,
            fullyQualifiedClassName: 'App\\Runner',
            isStatic: false,
            methodName: 'build',
            nameStart: 1,
            parameters: [
                {
                    hasDefault: false,
                    name: 'service',
                    resolvableByContainer: true,
                    signatureHint: 'UserService',
                },
                {
                    hasDefault: false,
                    name: 'label',
                    resolvableByContainer: false,
                    signatureHint: 'string',
                },
                {
                    defaultExpression: "'x'",
                    hasDefault: true,
                    name: 'suffix',
                    resolvableByContainer: false,
                    signatureHint: 'string',
                },
            ],
            start: 0,
            visibility: 'public',
        }

        const result = await resolveMethodArguments(method, prompt)

        expect(result).toEqual({ 1: "'value'" })
        expect(prompt).toHaveBeenCalledTimes(1)
        expect(prompt).toHaveBeenCalledWith(method, method.parameters[1])
    })

    it('prompts only required function parameters', async () => {
        const prompt = vi.fn(async () => "'value'")
        const callableFunction: FunctionInfo = {
            end: 10,
            fullyQualifiedFunctionName: '\\App\\build_report',
            functionName: 'build_report',
            nameStart: 1,
            namespaceName: 'App',
            parameters: [
                {
                    hasDefault: false,
                    name: 'label',
                    resolvableByContainer: false,
                    signatureHint: 'string',
                },
                {
                    defaultExpression: '1',
                    hasDefault: true,
                    name: 'count',
                    resolvableByContainer: false,
                    signatureHint: 'int',
                },
            ],
            start: 0,
        }

        const result = await resolveFunctionArguments(callableFunction, prompt)

        expect(result).toEqual({ 0: "'value'" })
        expect(prompt).toHaveBeenCalledTimes(1)
        expect(prompt).toHaveBeenCalledWith(
            callableFunction,
            callableFunction.parameters[0],
        )
    })
})
