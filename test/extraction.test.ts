import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import {
    extractFile,
    extractSelection,
    findMethodAtPosition,
    findMethods,
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
})
