import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import { createCursorEditor, createTextDocument } from '../helpers'
import { commands } from '../vscode'
import { useExtensionFixture } from './extension-fixture'
import { activateExtension, setActiveEditor } from './extension-test-helpers'

describe('extension ui context', () => {
    useExtensionFixture()

    it('updates run file context for class-only php files on activation', async () => {
        setActiveEditor(
            createCursorEditor(
                createTextDocument(`<?php
class UserController
{
    public function index()
    {
        return [];
    }
}
`),
                new vscode.Position(1, 0),
            ),
        )

        await activateExtension()

        expect(commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            'toTinker.showRunFile',
            false,
        )
    })

    it('updates run file context for top-level executable php files on activation', async () => {
        setActiveEditor(
            createCursorEditor(
                createTextDocument(`<?php
$value = 1;
return $value;
`),
                new vscode.Position(1, 0),
            ),
        )

        await activateExtension()

        expect(commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            'toTinker.showRunFile',
            true,
        )
    })
})
