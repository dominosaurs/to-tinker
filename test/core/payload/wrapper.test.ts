import { describe, expect, it } from 'vitest'
import {
    buildFunctionPayload,
    buildMethodPayload,
    buildTinkerPayload,
} from '../../../src/wrapper'

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
                '$__toTinkerResult = ($user->email);',
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
                "$__toTinkerResult = (route('clm.members.create'));",
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
                "$__toTinkerResult = (route('clm.members.create'));",
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
                '$user = User::first();\n$__toTinkerResult = ($user->email);',
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
$__toTinkerResult = (Inspiring::quote());`
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

    it('captures the final assignment value instead of suppressing it', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: '$val = getValue2();',
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                '$__toTinkerResult = ($val = getValue2());',
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('captures the final compound assignment value', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: '$count += 2;',
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                '$__toTinkerResult = ($count += 2);',
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('captures the actual expression value for increment statements', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: '$count++;',
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                '$__toTinkerResult = ($count++);',
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('ignores trailing comments when capturing the final statement', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode:
                '$val = getValue2(); // should print assigned value',
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                '$__toTinkerResult = ($val = getValue2());',
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('ignores leading comments before declarations when capturing a later call', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: `// 1. automatic save file before run command.
// 2. this extension should be smart enough to remove or ignore the comments

function getValue1(): int {
    return 30000;
}

getValue1(); // 3. selection and line modes should smart enough to call intended function`,
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                `// 1. automatic save file before run command.
// 2. this extension should be smart enough to remove or ignore the comments

function getValue1(): int {
    return 30000;
}
$__toTinkerResult = (getValue1());`,
                'utf8',
            ).toString('base64')}');`,
        )
    })

    it('captures simple assignments in smart selections', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: '$user = User::first()',
            smartCapture: true,
        })

        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                '$__toTinkerResult = ($user = User::first());',
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

    it('preserves captured result assignments instead of overwriting them with eval null', () => {
        const payload = buildTinkerPayload({
            fakeStorage: false,
            filePath: '/tmp/demo.php',
            sandboxEnabled: true,
            selectionOrFileCode: '$formatted = number_format($val);',
            smartCapture: true,
        })

        expect(payload).toContain(
            '$__toTinkerEvalResult = eval($__toTinkerUserCode);',
        )
        expect(payload).toContain('if (!is_null($__toTinkerEvalResult)) {')
        expect(payload).toContain(
            `$__toTinkerUserCode = base64_decode('${Buffer.from(
                '$__toTinkerResult = ($formatted = number_format($val));',
                'utf8',
            ).toString('base64')}');`,
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
