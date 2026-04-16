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
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'selection',
            selectionActiveOffset: functionEnd,
            selectionEndLine: document.positionAt(functionEnd).line,
            selectionEndOffset: functionEnd,
            selectionStartLine: document.positionAt(functionStart).line,
            selectionStartOffset: functionStart,
            selectionsCount: 1,
            targetOffset: functionEnd,
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
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'selection',
            selectionActiveOffset: document.offsetAt(end),
            selectionEndLine: end.line,
            selectionEndOffset: document.offsetAt(end),
            selectionStartLine: start.line,
            selectionStartOffset: document.offsetAt(start),
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
        const active = new vscode.Position(2, 6)

        const result = planRun({
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'line',
            selectionActiveOffset: document.offsetAt(active),
            selectionEndLine: active.line,
            selectionEndOffset: document.offsetAt(active),
            selectionStartLine: 2,
            selectionStartOffset: document.offsetAt(new vscode.Position(2, 0)),
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
        const start = new vscode.Position(1, 0)
        const end = new vscode.Position(1, 10)

        const result = planRun({
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'selection',
            selectionActiveOffset: document.offsetAt(end),
            selectionEndLine: end.line,
            selectionEndOffset: document.offsetAt(end),
            selectionStartLine: start.line,
            selectionStartOffset: document.offsetAt(start),
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
