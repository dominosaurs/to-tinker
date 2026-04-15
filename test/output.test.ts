import { describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { Output } from '../src/output'

describe('output', () => {
    it('opens markdown preview only once', async () => {
        const output = new Output()
        const executeCommand = vi.mocked(vscode.commands.executeCommand)

        executeCommand.mockClear()

        await output.show({
            status: 'running',
            summary: {
                filePath: '/tmp/demo.php',
                kind: 'selection',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        await output.show({
            result: '42',
            status: 'success',
            summary: {
                filePath: '/tmp/demo.php',
                kind: 'selection',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        expect(executeCommand).toHaveBeenCalledTimes(1)
        expect(executeCommand).toHaveBeenCalledWith(
            'markdown.showPreviewToSide',
            expect.anything(),
        )
    })
})
