import { describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { Output } from '../src/output'

describe('output', () => {
    it('reuses same webview panel across updates', async () => {
        const output = new Output()
        const createWebviewPanel = vi.mocked(vscode.window.createWebviewPanel)

        createWebviewPanel.mockClear()

        await output.show({
            status: 'running',
            summary: {
                filePath: '/tmp/demo.php',
                mode: 'selection',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        await output.show({
            result: '42',
            status: 'success',
            summary: {
                filePath: '/tmp/demo.php',
                mode: 'selection',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        expect(createWebviewPanel).toHaveBeenCalledTimes(1)
    })
})
