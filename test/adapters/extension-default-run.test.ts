import { describe, it } from 'vitest'
import type * as vscode from 'vscode'
import {
    createCursorEditor,
    createSelectionEditor,
    createTextDocument,
} from '../helpers'
import { executeTinker, useExtensionFixture } from './extension-fixture'
import {
    activateExtension,
    expectLastExecutionMode,
    runCommand,
    setActiveEditor,
} from './extension-test-helpers'

describe('extension default run', () => {
    useExtensionFixture()

    it.each([
        {
            label: 'final structural closer line',
            selection: (document: vscode.TextDocument, source: string) =>
                createCursorEditor(
                    document,
                    document.positionAt(source.indexOf('];') + 1),
                ),
            source: `<?php
use Illuminate\\Foundation\\Inspiring;

$quote = Inspiring::quote();

return [
    'original' => $quote,
];
`,
        },
        {
            label: 'trailing blank line after final closer',
            selection: (document: vscode.TextDocument, source: string) =>
                createCursorEditor(
                    document,
                    document.positionAt(source.length),
                ),
            source: `<?php
use Illuminate\\Foundation\\Inspiring;

$quote = Inspiring::quote();

return [
    'original' => $quote,
];

`,
        },
        {
            label: 'whitespace-only trailing selection',
            selection: (document: vscode.TextDocument, source: string) =>
                createSelectionEditor(
                    document,
                    document.positionAt(source.lastIndexOf('\n')),
                    document.positionAt(source.length),
                ),
            source: `<?php
use Illuminate\\Foundation\\Inspiring;

$quote = Inspiring::quote();

return [
    'original' => $quote,
];

`,
        },
        {
            label: 'trailing comment line after final closer',
            selection: (document: vscode.TextDocument, source: string) =>
                createCursorEditor(
                    document,
                    document.positionAt(source.indexOf('// trailing note') + 3),
                ),
            source: `<?php
use Illuminate\\Foundation\\Inspiring;

$quote = Inspiring::quote();

return [
    'original' => $quote,
];

// trailing note
`,
        },
    ])('defaults to file mode on $label', async ({ selection, source }) => {
        const document = createTextDocument(source)
        setActiveEditor(selection(document, source))

        await activateExtension()
        await runCommand('toTinker.runDefault')

        expectLastExecutionMode(executeTinker, 'file')
    })
})
