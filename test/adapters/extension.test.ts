import { describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import {
    createCursorEditor,
    createSelectionEditor,
    createTextDocument,
} from '../helpers'
import {
    buildTinkerPayload,
    executeTinker,
    prepareExecutionEnvironment,
    renderExecutionReport,
    setSandboxDefaultEnabled,
    useExtensionFixture,
} from './extension-fixture'
import {
    activateAndRunCommand,
    setActiveEditor,
} from './extension-test-helpers'

describe('extension orchestration', () => {
    useExtensionFixture()

    it('runs selection through preflight and execution pipeline', async () => {
        const document = createTextDocument('<?php\n$foo = 1;\n')
        setActiveEditor(
            createSelectionEditor(
                document,
                new vscode.Position(1, 0),
                new vscode.Position(1, 9),
            ),
        )

        await activateAndRunCommand('toTinker.runDefault')

        expect(prepareExecutionEnvironment).toHaveBeenCalledWith(document)
        expect(buildTinkerPayload).toHaveBeenCalled()
        expect(executeTinker).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'selection',
                phpExecutable: '/usr/bin/php',
            }),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
        expect(renderExecutionReport).toHaveBeenCalled()
    })

    it('saves a dirty active document before running', async () => {
        const save = vi.fn(async () => true)
        const document = createTextDocument(
            '<?php\n$foo = 1;\n',
            '/tmp/sample.php',
            {
                isDirty: true,
                save,
            },
        )
        setActiveEditor(createCursorEditor(document, new vscode.Position(1, 0)))

        await activateAndRunCommand('toTinker.runDefault')

        expect(save).toHaveBeenCalled()
    })

    it('aborts the run when saving the active document fails', async () => {
        const save = vi.fn(async () => false)
        const document = createTextDocument(
            '<?php\n$foo = 1;\n',
            '/tmp/sample.php',
            {
                isDirty: true,
                save,
            },
        )
        setActiveEditor(createCursorEditor(document, new vscode.Position(1, 0)))

        await activateAndRunCommand('toTinker.runDefault')

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Could not save the file before running To Tinker.',
        )
        expect(executeTinker).not.toHaveBeenCalled()
    })

    it('shows preflight errors without attempting execution', async () => {
        const document = createTextDocument('<?php\nreturn 1;\n')
        setActiveEditor(createCursorEditor(document, new vscode.Position(1, 0)))
        prepareExecutionEnvironment.mockImplementation(() => {
            throw new Error(
                'Configured PHP path does not exist: /missing/php. Update toTinker.phpPath or clear it to use php from PATH.',
            )
        })

        await activateAndRunCommand('toTinker.runDefault')

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Configured PHP path does not exist: /missing/php. Update toTinker.phpPath or clear it to use php from PATH.',
        )
        expect(executeTinker).not.toHaveBeenCalled()
    })

    it('toggles sandbox default setting', async () => {
        await activateAndRunCommand('toTinker.toggleSandbox')

        expect(setSandboxDefaultEnabled).toHaveBeenCalledWith(false)
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'To Tinker Dry Run mode disabled.',
        )
    })
})
