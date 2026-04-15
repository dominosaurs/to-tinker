import { describe, expect, it } from 'vitest'
import { buildMethodPayload, buildTinkerPayload } from '../src/wrapper'

describe('wrapper', () => {
    it('builds sandboxed selection payload', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: 'return 42;',
        })

        expect(payload).toContain('Mail::fake();')
        expect(payload).toContain('DB::connection')
        expect(payload).toContain('return 42;')
        expect(payload.startsWith('<?php')).toBe(false)
    })

    it('builds method payload with fqcn and prompted args', () => {
        const payload = buildMethodPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            method: {
                className: 'ReportRunner',
                end: 10,
                fullyQualifiedClassName: 'App\\Services\\ReportRunner',
                isStatic: false,
                methodName: 'build',
                namespaceName: 'App\\Services',
                parameters: [],
                start: 0,
                visibility: 'private',
            },
            promptedArguments: { 1: "'x'" },
            sandboxEnabled: false,
        })

        expect(payload).toContain(
            "new ReflectionMethod('App\\\\Services\\\\ReportRunner', 'build')",
        )
        expect(payload).toContain("$__toTinkerPromptedArgs = [1 => '\\'x\\''];")
        expect(payload).toContain('setAccessible(true)')
    })
})
