import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import {
    extractFile,
    extractSelection,
    findMethodAtPosition,
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
})
