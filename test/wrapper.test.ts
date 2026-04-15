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
        expect(payload).toContain(
            "$__toTinkerUserCode = base64_decode('cmV0dXJuIDQyOw==');",
        )
        expect(payload).toContain('eval($__toTinkerUserCode);')
        expect(payload.startsWith('<?php')).toBe(false)
    })

    it('wraps bare expressions for smart capture', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: '$user->email',
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                'return $user->email;',
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('wraps bare route helper expressions without a semicolon', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: "route('clm.members.create')",
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                "return route('clm.members.create');",
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('captures route helper expressions even when the selection already ends with a semicolon', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: "route('clm.members.create');",
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                "return route('clm.members.create');",
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('captures the last top-level expression in smart selections', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: '$user = User::first();\n$user->email',
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                '$user = User::first();\nreturn $user->email;',
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('keeps assignments as statements in smart selections', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: '$user = User::first()',
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                '$user = User::first();',
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('rejects incomplete fragments in smart selections', () => {
        expect(() =>
            buildTinkerPayload({
                fakeStorage: false,
                filePath: '/tmp/demo.php',
                sandboxEnabled: true,
                selectionOrFileCode: "'name' => $user->name",
                smartCapture: true,
            }),
        ).toThrow(
            'Selection is not a complete PHP statement or standalone expression. Select a full statement, or a complete expression like $user->email.',
        )
    })

    it('renders both buffered output and final result when available', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: 'dump($user);\n$user->email',
            smartCapture: true,
        })

        expect(payload).not.toContain('echo "Result:\\n";')
        expect(payload).toContain(
            'if (!str_ends_with($__toTinkerBufferedOutput, "\\n")) {',
        )
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
