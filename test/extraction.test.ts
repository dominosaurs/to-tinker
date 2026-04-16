import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import {
    extractFile,
    extractLine,
    extractSelection,
    findFunctionAtPosition,
    findFunctionMatchingSelection,
    findFunctions,
    findMethodAtPosition,
    findMethods,
    parseSelectedFunctionDeclaration,
} from '../src/extraction'
import { createTextDocument } from './helpers'

describe('extraction', () => {
    it('strips php tags from file', () => {
        const document = createTextDocument('<?php\n\nreturn 1;\n')
        expect(extractFile(document)).toBe('return 1;')
    })

    it('extracts non-empty selection', () => {
        const document = createTextDocument('<?php\n$foo = 1;\n$bar = 2;')
        const selection = new vscode.Selection(
            new vscode.Position(1, 0),
            new vscode.Position(1, 9),
        )
        expect(extractSelection(document, selection)).toBe('$foo = 1;')
    })

    it('extracts current line at cursor', () => {
        const document = createTextDocument('<?php\n    $foo = 1;\n$bar = 2;')

        expect(extractLine(document, new vscode.Position(1, 4))).toBe(
            '$foo = 1;',
        )
    })

    it('finds method under cursor with namespace and params', () => {
        const text = `<?php
namespace App\\Services;

class ReportRunner
{
    private function build(UserService $users, string $name = 'x')
    {
        return $name;
    }
}
`
        const document = createTextDocument(text)
        const method = findMethodAtPosition(
            document,
            new vscode.Position(5, 10),
        )

        expect(method.className).toBe('ReportRunner')
        expect(method.fullyQualifiedClassName).toBe(
            'App\\Services\\ReportRunner',
        )
        expect(method.methodName).toBe('build')
        expect(method.visibility).toBe('private')
        expect(method.parameters).toEqual([
            {
                defaultExpression: undefined,
                hasDefault: false,
                name: 'users',
                resolvableByContainer: true,
                signatureHint: 'UserService',
            },
            {
                defaultExpression: "'x'",
                hasDefault: true,
                name: 'name',
                resolvableByContainer: false,
                signatureHint: 'string',
            },
        ])
    })

    it('supports attributed methods with multiline signatures and reference returns', () => {
        const text = `<?php
namespace App\\Services;

final readonly class ReportRunner
{
    #[Example('demo')]
    public static function &build(
        #[Config('users')] UserService $users,
        string $label = "a,b",
        array $options = ['x' => ['y', 'z']],
    ): UserService|array
    {
        return $users;
    }
}
`
        const document = createTextDocument(text)
        const [method] = findMethods(document)

        expect(method?.className).toBe('ReportRunner')
        expect(method?.methodName).toBe('build')
        expect(method?.isStatic).toBe(true)
        expect(method?.parameters).toEqual([
            {
                defaultExpression: undefined,
                hasDefault: false,
                name: 'users',
                resolvableByContainer: true,
                signatureHint: 'UserService',
            },
            {
                defaultExpression: '"a,b"',
                hasDefault: true,
                name: 'label',
                resolvableByContainer: false,
                signatureHint: 'string',
            },
            {
                defaultExpression: "['x' => ['y', 'z']]",
                hasDefault: true,
                name: 'options',
                resolvableByContainer: false,
                signatureHint: 'array',
            },
        ])
    })

    it('ignores abstract class methods for runnable targets', () => {
        const text = `<?php
abstract class BaseRunner
{
    public function build(): void
    {
    }
}
`
        const document = createTextDocument(text)

        expect(findMethods(document)).toEqual([])
    })

    it('finds top-level namespaced functions and resolves them at position', () => {
        const text = `<?php
namespace App\\Support;

function &build_report(string $name, int $count = 1)
{
    return $name;
}
`
        const document = createTextDocument(text)
        const [callableFunction] = findFunctions(document)
        const resolved = findFunctionAtPosition(
            document,
            new vscode.Position(3, 15),
        )

        expect(callableFunction?.functionName).toBe('build_report')
        expect(callableFunction?.fullyQualifiedFunctionName).toBe(
            '\\App\\Support\\build_report',
        )
        expect(callableFunction?.parameters).toEqual([
            {
                defaultExpression: undefined,
                hasDefault: false,
                name: 'name',
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
        ])
        expect(resolved.functionName).toBe('build_report')
    })

    it('matches a selected full function declaration even with surrounding whitespace', () => {
        const text = `<?php

function build_report(string $name)
{
    return $name;
}

`
        const document = createTextDocument(text)
        const start = text.indexOf('\nfunction')
        const end = text.lastIndexOf('}\n') + 2
        const selection = new vscode.Selection(
            document.positionAt(start),
            document.positionAt(end),
        )

        expect(
            findFunctionMatchingSelection(document, selection)?.functionName,
        ).toBe('build_report')
    })

    it('parses a selected nested function declaration inside a method', () => {
        const text = `<?php
namespace App\\Support;

class Runner {
    public function build() {
        function helper_inside(string $name) {
            return $name;
        }
    }
}
`
        const document = createTextDocument(text)
        const start = text.indexOf('function helper_inside')
        const end = text.indexOf('\n        }', start)
        const selection = new vscode.Selection(
            document.positionAt(start),
            document.positionAt(end + 11),
        )

        expect(parseSelectedFunctionDeclaration(document, selection)).toEqual(
            expect.objectContaining({
                fullyQualifiedFunctionName: '\\App\\Support\\helper_inside',
                functionName: 'helper_inside',
            }),
        )
    })

    it('ignores closures, nested functions, conditional functions, and methods when finding runnable functions', () => {
        const text = `<?php
function top_level() {
    return true;
}

$closure = function () {
    return false;
};

$arrow = fn () => true;

function outer() {
    function inner() {
        return true;
    }
}

if (!function_exists('maybe_defined')) {
    function maybe_defined() {
        return true;
    }
}

class Runner {
    public function build() {
        return true;
    }
}
`
        const document = createTextDocument(text)

        expect(
            findFunctions(document).map(callable => callable.functionName),
        ).toEqual(['top_level', 'outer'])
    })

    it('does not treat functions nested inside methods as class methods', () => {
        const text = `<?php
class Runner {
    public function build() {
        function helper_inside_method() {
            return true;
        }

        return helper_inside_method();
    }
}
`
        const document = createTextDocument(text)

        expect(findMethods(document).map(method => method.methodName)).toEqual([
            'build',
        ])
    })
})
