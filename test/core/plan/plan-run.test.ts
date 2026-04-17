import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import { planRun } from '../../../src/core/plan/plan-run'
import { createTextDocument } from '../../helpers'

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

    it('uses callable-scoped eval for a selection inside a function body', () => {
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

    it('preserves prior callable statements for selected expressions that depend on local variables', () => {
        const source = [
            '<?php',
            'function build_report() {',
            '    $user = User::query()->find(1);',
            '    $user->name = fake()->name();',
            '    return [',
            "        'user_email' => $user->email,",
            '    ];',
            '}',
            '',
        ].join('\n')
        const document = createTextDocument(source)
        const start = source.indexOf('$user->email')
        const end = start + '$user->email'.length

        const result = planRun({
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'selection',
            selectionActiveOffset: end,
            selectionEndLine: document.positionAt(end).line,
            selectionEndOffset: end,
            selectionStartLine: document.positionAt(start).line,
            selectionStartOffset: start,
            selectionsCount: 1,
        })

        expect(result).toEqual({
            ok: true,
            plan: expect.objectContaining({
                mode: 'selection',
                sourceCode: [
                    '$user = User::query()->find(1);',
                    '$user->name = fake()->name();',
                    '$user->email',
                ].join('\n'),
                strategy: 'eval',
            }),
        })
    })

    it('reduces selected array entries to their value expression inside callables', () => {
        const source = [
            '<?php',
            'function build_report() {',
            '    $user = User::query()->find(1);',
            '    return [',
            "        'user_name' => $user->name,",
            '    ];',
            '}',
            '',
        ].join('\n')
        const document = createTextDocument(source)
        const start = source.indexOf("'user_name'")
        const end = source.indexOf(',', start)

        const result = planRun({
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'selection',
            selectionActiveOffset: end,
            selectionEndLine: document.positionAt(end).line,
            selectionEndOffset: end,
            selectionStartLine: document.positionAt(start).line,
            selectionStartOffset: start,
            selectionsCount: 1,
        })

        expect(result).toEqual({
            ok: true,
            plan: expect.objectContaining({
                mode: 'selection',
                sourceCode: [
                    '$user = User::query()->find(1);',
                    '$user->name',
                ].join('\n'),
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

    it('reduces top-level array-entry lines to their value expression', () => {
        const source = [
            '<?php',
            'use Illuminate\\Foundation\\Inspiring;',
            '',
            '$quote = Inspiring::quote();',
            '',
            'return [',
            "    'original' => $quote,",
            '];',
            '',
        ].join('\n')
        const document = createTextDocument(source)
        const active = new vscode.Position(6, 24)

        const result = planRun({
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'line',
            selectionActiveOffset: document.offsetAt(active),
            selectionEndLine: active.line,
            selectionEndOffset: document.offsetAt(active),
            selectionStartLine: active.line,
            selectionStartOffset: document.offsetAt(new vscode.Position(6, 0)),
            selectionsCount: 1,
        })

        expect(result).toEqual({
            ok: true,
            plan: expect.objectContaining({
                mode: 'line',
                sourceCode: [
                    'use Illuminate\\Foundation\\Inspiring;',
                    '$quote = Inspiring::quote();',
                    '$quote',
                ].join('\n'),
                sourceLineEnd: 7,
                sourceLineStart: 1,
                strategy: 'eval',
            }),
        })
    })

    it('keeps top-level function declarations available for later line runs', () => {
        const source = [
            '<?php',
            'use Illuminate\\Support\\Str;',
            '',
            'function formatString(string $string, string $mode): string {',
            '    return match ($mode) {',
            "        'slug' => Str::slug($string),",
            "        'title' => Str::title($string),",
            "        default => throw new Exception('Invalid mode'),",
            '    };',
            '}',
            '',
            "$quote = 'Hello world';",
            "formatString($quote, 'title');",
            '',
        ].join('\n')
        const document = createTextDocument(source)
        const active = new vscode.Position(12, 12)

        const result = planRun({
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'line',
            selectionActiveOffset: document.offsetAt(active),
            selectionEndLine: active.line,
            selectionEndOffset: document.offsetAt(active),
            selectionStartLine: active.line,
            selectionStartOffset: document.offsetAt(new vscode.Position(12, 0)),
            selectionsCount: 1,
        })

        expect(result).toEqual({
            ok: true,
            plan: expect.objectContaining({
                sourceCode: [
                    'use Illuminate\\Support\\Str;',
                    'function formatString(string $string, string $mode): string {',
                    '    return match ($mode) {',
                    "        'slug' => Str::slug($string),",
                    "        'title' => Str::title($string),",
                    "        default => throw new Exception('Invalid mode'),",
                    '    };',
                    '}',
                    "$quote = 'Hello world';",
                    "formatString($quote, 'title');",
                ].join('\n'),
            }),
        })
    })

    it('replays prior top-level array-entry assignments before later lines', () => {
        const source = [
            '<?php',
            'use Illuminate\\Foundation\\Inspiring;',
            'use Illuminate\\Support\\Str;',
            '',
            'function formatString(string $string, string $mode): string {',
            '    return match ($mode) {',
            "        'slug' => Str::slug($string),",
            "        'title' => Str::title($string),",
            "        default => throw new Exception('Invalid mode'),",
            '    };',
            '}',
            '',
            '$formattedQuote = [',
            "    'original' => $quote = Inspiring::quotes()->random(),",
            "    'slug' => formatString($quote, 'slug'),",
            '];',
            '',
        ].join('\n')
        const document = createTextDocument(source)
        const active = new vscode.Position(14, 10)

        const result = planRun({
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'line',
            selectionActiveOffset: document.offsetAt(active),
            selectionEndLine: active.line,
            selectionEndOffset: document.offsetAt(active),
            selectionStartLine: active.line,
            selectionStartOffset: document.offsetAt(new vscode.Position(14, 0)),
            selectionsCount: 1,
        })

        expect(result).toEqual({
            ok: true,
            plan: expect.objectContaining({
                sourceCode: [
                    'use Illuminate\\Foundation\\Inspiring;',
                    'use Illuminate\\Support\\Str;',
                    'function formatString(string $string, string $mode): string {',
                    '    return match ($mode) {',
                    "        'slug' => Str::slug($string),",
                    "        'title' => Str::title($string),",
                    "        default => throw new Exception('Invalid mode'),",
                    '    };',
                    '}',
                    '$quote = Inspiring::quotes()->random();',
                    "formatString($quote, 'slug')",
                ].join('\n'),
            }),
        })
    })

    it('keeps top-level function declarations available for later selections', () => {
        const source = [
            '<?php',
            'use Illuminate\\Support\\Str;',
            '',
            'function formatString(string $string, string $mode): string {',
            '    return match ($mode) {',
            "        'slug' => Str::slug($string),",
            "        'title' => Str::title($string),",
            "        default => throw new Exception('Invalid mode'),",
            '    };',
            '}',
            '',
            "$quote = 'Hello world';",
            "$formatted = formatString($quote, 'title');",
            '',
        ].join('\n')
        const document = createTextDocument(source)
        const start = source.indexOf("formatString($quote, 'title')")
        const end = start + "formatString($quote, 'title')".length

        const result = planRun({
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'selection',
            selectionActiveOffset: end,
            selectionEndLine: document.positionAt(end).line,
            selectionEndOffset: end,
            selectionStartLine: document.positionAt(start).line,
            selectionStartOffset: start,
            selectionsCount: 1,
        })

        expect(result).toEqual({
            ok: true,
            plan: expect.objectContaining({
                sourceCode: [
                    'use Illuminate\\Support\\Str;',
                    'function formatString(string $string, string $mode): string {',
                    '    return match ($mode) {',
                    "        'slug' => Str::slug($string),",
                    "        'title' => Str::title($string),",
                    "        default => throw new Exception('Invalid mode'),",
                    '    };',
                    '}',
                    "$quote = 'Hello world';",
                    "formatString($quote, 'title')",
                ].join('\n'),
            }),
        })
    })

    it('returns a typed planning error for multiple selections', () => {
        const document = createTextDocument('<?php\n$value = 1;\n')
        const start = new vscode.Position(1, 0)
        const end = new vscode.Position(1, 22)

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

    it('returns a typed planning error for incomplete top-level selection boundaries', () => {
        const document = createTextDocument(
            '<?php\n$value = number_format(1000);\n',
        )
        const start = new vscode.Position(1, 0)
        const end = new vscode.Position(1, 25)

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
            error: {
                kind: 'incomplete-boundary',
                message:
                    'Selection is not a complete PHP statement or standalone expression. Select a full statement, or a complete expression like $user->email.',
            },
            ok: false,
        })
    })

    it('returns a typed planning error when no method exists at the target position', () => {
        const document = createTextDocument('<?php\n$value = 1;\n')
        const position = new vscode.Position(1, 3)

        const result = planRun({
            documentPath: document.uri.fsPath,
            documentText: document.getText(),
            languageId: document.languageId,
            requestedMode: 'method',
            selectionActiveOffset: document.offsetAt(position),
            selectionEndLine: position.line,
            selectionEndOffset: document.offsetAt(position),
            selectionStartLine: position.line,
            selectionStartOffset: document.offsetAt(position),
            selectionsCount: 1,
        })

        expect(result).toEqual({
            error: {
                kind: 'no-callable-at-position',
                message:
                    'Cursor is not inside a supported concrete class method.',
            },
            ok: false,
        })
    })
})
