import { describe, expect, it } from 'vitest'
import * as vscode from 'vscode'
import { COMMANDS } from '../../src/commands'
import { createCursorEditor, createTextDocument } from '../helpers'
import { commands, env, window, workspace } from '../vscode'
import { useExtensionFixture } from './extension-fixture'
import {
    activateAndRunCommand,
    activateExtension,
    setActiveEditor,
} from './extension-test-helpers'

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

    it('updates run file context for function-only php files on activation', async () => {
        setActiveEditor(
            createCursorEditor(
                createTextDocument(`<?php
use Illuminate\\Support\\Str;

function slugify(string $value): string
{
    return Str::slug($value);
}
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

    it('opens external docs links from the result view command bridge', async () => {
        await activateAndRunCommand(COMMANDS.openResultTypeLink, {
            kind: 'external',
            value: 'https://www.php.net/manual/en/language.types.string.php',
        })

        expect(env.openExternal).toHaveBeenCalledWith(
            expect.objectContaining({
                fsPath: 'https://www.php.net/manual/en/language.types.string.php',
            }),
        )
    })

    it('opens local app class files from the result view command bridge', async () => {
        await activateAndRunCommand(COMMANDS.openResultTypeLink, {
            kind: 'local',
            value: '/workspace/app/Models/User.php',
        })

        expect(workspace.openTextDocument).toHaveBeenCalledWith(
            expect.objectContaining({
                fsPath: '/workspace/app/Models/User.php',
            }),
        )
        expect(window.showTextDocument).toHaveBeenCalled()
    })
})
