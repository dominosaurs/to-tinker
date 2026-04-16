import { describe, expect, it } from 'vitest'
import {
    buildFunctionPayload,
    buildMethodPayload,
    buildTinkerPayload,
} from '../src/wrapper'

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

    it('captures the last top-level expression in file-shaped code with earlier statements', () => {
        const transformed = `use Illuminate\\Foundation\\Inspiring;
function getRandom() {
    return rand(1, 10);
}

getRandom();
return Inspiring::quote();`
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: `use Illuminate\\Foundation\\Inspiring;

function getRandom() {
    return rand(1, 10);
}

getRandom();

Inspiring::quote();`,
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(transformed, 'utf8').toString('base64')}');`,
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
                nameStart: 0,
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
        expect(payload).toContain('ob_start();')
        expect(payload).toContain('$__toTinkerBufferedOutput = ob_get_clean();')
    })

    it('builds function payload with require_once and fully-qualified invocation', () => {
        const payload = buildFunctionPayload({
            callableFunction: {
                end: 10,
                fullyQualifiedFunctionName: '\\App\\Support\\build_report',
                functionName: 'build_report',
                nameStart: 0,
                namespaceName: 'App\\Support',
                parameters: [],
                start: 0,
            },
            fakeStorage: false,
            filePath: '/tmp/helpers.php',
            promptedArguments: { 0: "'x'" },
            sandboxEnabled: false,
        })

        expect(payload).toContain('require_once $__toTinkerFile;')
        expect(payload).toContain(
            "$__toTinkerFunction = '\\\\App\\\\Support\\\\build_report';",
        )
        expect(payload).toContain(
            'if (!function_exists($__toTinkerFunction)) {',
        )
        expect(payload).toContain(
            'new ReflectionFunction($__toTinkerFunction);',
        )
        expect(payload).toContain('ob_start();')
        expect(payload).toContain('$__toTinkerBufferedOutput = ob_get_clean();')
    })

    it('builds eval-backed function payload for selected nested declarations', () => {
        const payload = buildFunctionPayload({
            callableFunction: {
                end: 10,
                fullyQualifiedFunctionName: '\\App\\Support\\helper_inside',
                functionName: 'helper_inside',
                nameStart: 0,
                namespaceName: 'App\\Support',
                parameters: [],
                start: 0,
            },
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            functionDeclarationSource:
                "function helper_inside() { echo 'x'; return 1; }",
            sandboxEnabled: false,
        })

        expect(payload).toContain('$__toTinkerFunctionDeclaration =')
        expect(payload).toContain('eval($__toTinkerFunctionDeclaration);')
        expect(payload).not.toContain('require_once $__toTinkerFile;')
    })

    it('constructs the class when running __construct', () => {
        const payload = buildMethodPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            method: {
                className: 'ReportRunner',
                end: 10,
                fullyQualifiedClassName: 'App\\Services\\ReportRunner',
                isStatic: false,
                methodName: '__construct',
                nameStart: 0,
                namespaceName: 'App\\Services',
                parameters: [],
                start: 0,
                visibility: 'public',
            },
            sandboxEnabled: false,
        })

        expect(payload).toContain(
            "if ($__toTinkerReflector->getName() === '__construct') {",
        )
        expect(payload).toContain(
            'new $__toTinkerDeclaringClass(...$__toTinkerArgs);',
        )
    })
})
