import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import { planRun } from '../src/core/plan/plan-run'
import { createTextDocument } from './helpers'

describe('planRun', () => {
    it('promotes a full selected function declaration to function strategy', () => {
        const source = [
            '<?php',
            'function build_report(string $label) {',
            '    return $label;',
            '}',
            '',
        ].join('\n')
        const document = createTextDocument(source)
        const functionStart = source.indexOf('function build_report')
        const functionEnd = source.lastIndexOf('}') + 1

        const result = planRun({
            document,
            requestedMode: 'selection',
            selection: new vscode.Selection(
                document.positionAt(functionStart),
                document.positionAt(functionEnd),
            ),
            selectionsCount: 1,
        })

        expect(result).toEqual({
            ok: true,
            plan: expect.objectContaining({
                callableFunction: expect.objectContaining({
                    functionName: 'build_report',
                }),
                mode: 'function',
                strategy: 'function',
            }),
        })
    })

    it('uses snippet-only eval for a selection inside a function body', () => {
        const source = [
            '<?php',
            'function build_report() {',
            '    $value = 1;',
            '    $value;',
            '}',
            '',
        ].join('\n')
        const document = createTextDocument(source)
        const start = document.positionAt(source.indexOf('$value = 1;'))
        const end = document.positionAt(
            source.indexOf('$value;') + '$value;'.length,
        )

        const result = planRun({
            document,
            requestedMode: 'selection',
            selection: new vscode.Selection(start, end),
            selectionsCount: 1,
        })

        expect(result).toEqual({
            ok: true,
            plan: expect.objectContaining({
                mode: 'selection',
                sourceCode: '$value = 1;\n    $value;',
                sourceLineEnd: 4,
                sourceLineStart: 3,
                strategy: 'eval',
            }),
        })
    })

    it('uses prefix eval for top-level line runs', () => {
        const source = ['<?php', '$value = 1;', '$value;', ''].join('\n')
        const document = createTextDocument(source)

        const result = planRun({
            document,
            requestedMode: 'line',
            selection: new vscode.Selection(
                new vscode.Position(2, 0),
                new vscode.Position(2, 6),
            ),
            selectionsCount: 1,
        })

        expect(result).toEqual({
            ok: true,
            plan: expect.objectContaining({
                mode: 'line',
                sourceCode: '$value = 1;\n$value;',
                sourceLineEnd: 3,
                sourceLineStart: 1,
                strategy: 'eval',
            }),
        })
    })

    it('returns a typed planning error for multiple selections', () => {
        const document = createTextDocument('<?php\n$value = 1;\n')

        const result = planRun({
            document,
            requestedMode: 'selection',
            selection: new vscode.Selection(
                new vscode.Position(1, 0),
                new vscode.Position(1, 10),
            ),
            selectionsCount: 2,
        })

        expect(result).toEqual({
            error: {
                kind: 'multiple-selections',
                message: 'Multiple selections are not supported.',
            },
            ok: false,
        })
    })
})
