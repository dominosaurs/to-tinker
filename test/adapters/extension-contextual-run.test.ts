import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import {
    createCursorEditor,
    createSelection,
    createSelectionEditor,
    createTextDocument,
} from '../helpers'
import { buildTinkerPayload, useExtensionFixture } from './extension-fixture'
import {
    activateAndRunCommand,
    activateExtension,
    runCommand,
    setActiveEditor,
} from './extension-test-helpers'

describe('extension contextual run', () => {
    useExtensionFixture()

    it('runs the current line when default command is used without a selection', async () => {
        const document = createTextDocument('<?php\n$foo = 1;\n')
        setActiveEditor(createCursorEditor(document, new vscode.Position(1, 0)))

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$__toTinkerResult = ($foo = 1);',
            }),
        )
    })

    it('runs file mode with last-expression capture for final returnable lines', async () => {
        const document = createTextDocument(`<?php
use Illuminate\\Foundation\\Inspiring;

function getRandom() {
    return rand(1, 10);
}

getRandom();

Inspiring::quote();
`)
        setActiveEditor(createCursorEditor(document, new vscode.Position(8, 0)))

        await activateAndRunCommand('toTinker.runFile')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: `use Illuminate\\Foundation\\Inspiring;
function getRandom() {
    return rand(1, 10);
}
getRandom();
$__toTinkerResult = (Inspiring::quote());`,
            }),
        )
    })

    it('keeps top-level function declarations in line runs that call them later', async () => {
        const source = `<?php
use Illuminate\\Support\\Str;

function formatString(string $string, string $mode): string {
    return match ($mode) {
        'slug' => Str::slug($string),
        'title' => Str::title($string),
        default => throw new Exception('Invalid mode'),
    };
}

$quote = 'Hello world';
$formatted = [
    'title' => formatString($quote, 'title'),
];
`
        const document = createTextDocument(source)
        const targetOffset = source.indexOf(
            "'title' => formatString($quote, 'title')",
        )
        setActiveEditor(
            createCursorEditor(document, document.positionAt(targetOffset + 1)),
        )

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: [
                    'use Illuminate\\Support\\Str;',
                    'function formatString(string $string, string $mode): string {',
                    '    return match ($mode) {',
                    "        'slug' => Str::slug($string),",
                    "        'title' => Str::title($string),",
                    "        default => throw new Exception('Invalid mode'),",
                    '    };',
                    '}',
                    "$quote = 'Hello world';",
                    "$__toTinkerResult = (formatString($quote, 'title'));",
                ].join('\n'),
            }),
        )
    })

    it('runs the current line through the execution pipeline', async () => {
        const document = createTextDocument('<?php\n$foo = 1;\n$bar = 2;\n')
        setActiveEditor(createCursorEditor(document, new vscode.Position(2, 3)))

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$foo = 1;\n$__toTinkerResult = ($bar = 2);',
            }),
        )
    })

    it('runs selection mode as file prefix through selection end', async () => {
        const document = createTextDocument(
            '<?php\n$foo = 1;\n$bar = 2;\n$baz = 3;\n',
        )
        setActiveEditor(
            createSelectionEditor(
                document,
                new vscode.Position(2, 0),
                new vscode.Position(2, 9),
            ),
        )

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$foo = 1;\n$__toTinkerResult = ($bar = 2);',
            }),
        )
    })

    it('runs top-level array-entry lines as value expressions with prior context', async () => {
        const document = createTextDocument(`<?php
use Illuminate\\Foundation\\Inspiring;

$quote = Inspiring::quote();

return [
    'original' => $quote,
];
`)
        setActiveEditor(
            createCursorEditor(document, new vscode.Position(5, 23)),
        )

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: [
                    'use Illuminate\\Foundation\\Inspiring;',
                    '$quote = Inspiring::quote();',
                    '$__toTinkerResult = ($quote);',
                ].join('\n'),
            }),
        )
    })

    it('runs each top-level array entry line with prior context', async () => {
        const source = `<?php
use Illuminate\\Foundation\\Inspiring;
use Illuminate\\Support\\Str;

$quote = Inspiring::quote();

return [
    'original' => $quote,
    'slug'     => Str::slug($quote),
    'title'    => Str::title($quote),
    'uuid'     => Str::uuid()->toString(),
];
`
        const document = createTextDocument(source)
        const entryCases = [
            {
                expected: [
                    'use Illuminate\\Foundation\\Inspiring;',
                    'use Illuminate\\Support\\Str;',
                    '$quote = Inspiring::quote();',
                    '$__toTinkerResult = ($quote);',
                ].join('\n'),
                target: "'original' => $quote",
            },
            {
                expected: [
                    'use Illuminate\\Foundation\\Inspiring;',
                    'use Illuminate\\Support\\Str;',
                    '$quote = Inspiring::quote();',
                    '$quote;',
                    '$__toTinkerResult = (Str::slug($quote));',
                ].join('\n'),
                target: "'slug'     => Str::slug($quote)",
            },
            {
                expected: [
                    'use Illuminate\\Foundation\\Inspiring;',
                    'use Illuminate\\Support\\Str;',
                    '$quote = Inspiring::quote();',
                    '$quote;',
                    'Str::slug($quote);',
                    '$__toTinkerResult = (Str::title($quote));',
                ].join('\n'),
                target: "'title'    => Str::title($quote)",
            },
            {
                expected: [
                    'use Illuminate\\Foundation\\Inspiring;',
                    'use Illuminate\\Support\\Str;',
                    '$quote = Inspiring::quote();',
                    '$quote;',
                    'Str::slug($quote);',
                    'Str::title($quote);',
                    '$__toTinkerResult = (Str::uuid()->toString());',
                ].join('\n'),
                target: "'uuid'     => Str::uuid()->toString()",
            },
        ]

        await activateExtension()

        for (const entryCase of entryCases) {
            buildTinkerPayload.mockClear()
            const targetOffset = source.indexOf(entryCase.target)
            setActiveEditor(
                createCursorEditor(
                    document,
                    document.positionAt(targetOffset + 1),
                ),
            )

            await runCommand('toTinker.runDefault')

            expect(buildTinkerPayload).toHaveBeenCalledWith(
                expect.objectContaining({
                    preparedUserCode: entryCase.expected,
                }),
            )
        }
    })

    it('runs array-entry assignment lines by returning assigned value', async () => {
        const source = `<?php
use Illuminate\\Foundation\\Inspiring;
use Illuminate\\Support\\Str;

function formatString(string $string, string $mode): string
{
    return match ($mode) {
        'slug' => Str::slug($string),
        'title' => Str::title($string),
        default => throw new Exception('Invalid mode'),
    };
}

$formattedQuote = [
    'original' => $quote = Inspiring::quotes()->random(),
    'slug' => formatString($quote, 'slug'),
    'title' => formatString($quote, 'title'),
];
`
        const document = createTextDocument(source)
        const targetOffset = source.indexOf(
            "'original' => $quote = Inspiring::quotes()->random()",
        )
        setActiveEditor(
            createCursorEditor(document, document.positionAt(targetOffset + 1)),
        )

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: [
                    'use Illuminate\\Foundation\\Inspiring;',
                    'use Illuminate\\Support\\Str;',
                    'function formatString(string $string, string $mode): string',
                    '{',
                    '    return match ($mode) {',
                    "        'slug' => Str::slug($string),",
                    "        'title' => Str::title($string),",
                    "        default => throw new Exception('Invalid mode'),",
                    '    };',
                    '}',
                    '$__toTinkerResult = ($quote = Inspiring::quotes()->random());',
                ].join('\n'),
            }),
        )
    })

    it('keeps top-level function declarations in top-level array-entry line runs', async () => {
        const source = `<?php
use Illuminate\\Foundation\\Inspiring;
use Illuminate\\Support\\Str;

function formatString(string $string, string $mode): string
{
    return match ($mode) {
        'slug' => Str::slug($string),
        'title' => Str::title($string),
        default => throw new Exception('Invalid mode'),
    };
}

$formattedQuote = [
    'original' => $quote = Inspiring::quotes()->random(),
    'slug' => formatString($quote, 'slug'),
    'title' => formatString($quote, 'title'),
];
`
        const document = createTextDocument(source)
        const targetOffset = source.indexOf(
            "'slug' => formatString($quote, 'slug')",
        )
        setActiveEditor(
            createCursorEditor(document, document.positionAt(targetOffset + 1)),
        )

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: [
                    'use Illuminate\\Foundation\\Inspiring;',
                    'use Illuminate\\Support\\Str;',
                    'function formatString(string $string, string $mode): string',
                    '{',
                    '    return match ($mode) {',
                    "        'slug' => Str::slug($string),",
                    "        'title' => Str::title($string),",
                    "        default => throw new Exception('Invalid mode'),",
                    '    };',
                    '}',
                    '$quote = Inspiring::quotes()->random();',
                    "$__toTinkerResult = (formatString($quote, 'slug'));",
                ].join('\n'),
            }),
        )
    })

    it('runs line inside a method with prior callable context', async () => {
        const document = createTextDocument(`<?php
class ReportRunner {
    public function build() {
        $foo = 1;
        $bar = 2;
    }
}`)
        setActiveEditor(createCursorEditor(document, new vscode.Position(4, 5)))

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$foo = 1;\n$__toTinkerResult = ($bar = 2);',
            }),
        )
    })

    it('runs selection inside a method with prior callable context', async () => {
        const document = createTextDocument(`<?php
class ReportRunner {
    public function build() {
        $foo = 1;
        $bar = 2;
    }
}`)
        setActiveEditor(
            createSelectionEditor(
                document,
                new vscode.Position(3, 8),
                new vscode.Position(3, 16),
            ),
        )

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$__toTinkerResult = ($foo = 1);',
            }),
        )
    })

    it('runs line inside a plain function with prior callable context', async () => {
        const document = createTextDocument(`<?php
function build() {
    $foo = 1;
    $bar = 2;
}`)
        setActiveEditor(createCursorEditor(document, new vscode.Position(3, 5)))

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$foo = 1;\n$__toTinkerResult = ($bar = 2);',
            }),
        )
    })

    it('runs selection inside a plain function with prior callable context', async () => {
        const document = createTextDocument(`<?php
function build() {
    $foo = 1;
    $bar = 2;
}`)
        setActiveEditor(
            createSelectionEditor(
                document,
                new vscode.Position(2, 4),
                new vscode.Position(2, 12),
            ),
        )

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: '$__toTinkerResult = ($foo = 1);',
            }),
        )
    })

    it('runs array-entry lines inside a method as value expressions with prior context', async () => {
        const document = createTextDocument(`<?php
class ReportRunner {
    public function build() {
        $user = User::query()->find(1);
        return [
            'user_name' => $user->name,
        ];
    }
}`)
        setActiveEditor(
            createCursorEditor(document, new vscode.Position(4, 33)),
        )

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode:
                    '$user = User::query()->find(1);\n$__toTinkerResult = ($user->name);',
            }),
        )
    })

    it('runs selected expressions inside a method with prior local context', async () => {
        const source = `<?php
class ReportRunner {
    public function build() {
        $user = User::query()->find(1);
        $user->name = fake()->name();
        return [
            'user_email' => $user->email,
        ];
    }
}`
        const document = createTextDocument(source)
        const start = source.indexOf('$user->email')
        const end = start + '$user->email'.length
        setActiveEditor({
            document,
            selection: createSelection(
                document.positionAt(start),
                document.positionAt(end),
            ),
            selections: [
                createSelection(
                    document.positionAt(start),
                    document.positionAt(end),
                ),
            ],
        })

        await activateAndRunCommand('toTinker.runDefault')

        expect(buildTinkerPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                preparedUserCode: [
                    '$user = User::query()->find(1);',
                    '$user->name = fake()->name();',
                    '$__toTinkerResult = ($user->email);',
                ].join('\n'),
            }),
        )
    })
})
