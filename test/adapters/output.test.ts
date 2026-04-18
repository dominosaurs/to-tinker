import { describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { Output } from '../../src/output'
import { renderResultView } from '../../src/result-view'

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

    it('shows extension name and version in the result page header', async () => {
        const output = new Output()
        const panel = {
            dispose: vi.fn(),
            onDidDispose: vi.fn(),
            reveal: vi.fn(),
            webview: { html: '' },
        }
        vi.mocked(vscode.window.createWebviewPanel).mockReturnValueOnce(
            panel as unknown as vscode.WebviewPanel,
        )

        output.register({
            extension: {
                packageJSON: {
                    displayName: 'To Tinker',
                    version: '0.1.1',
                },
            },
        } as unknown as vscode.ExtensionContext)

        await output.show({
            status: 'success',
            summary: {
                filePath: '/tmp/demo.php',
                mode: 'selection',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        expect(panel.webview.html).toContain('To Tinker v0.1.1')
    })

    it('enables command uris in the report webview', async () => {
        const output = new Output()

        await output.show({
            status: 'success',
            summary: {
                filePath: '/tmp/demo.php',
                mode: 'selection',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
            'toTinkerReport',
            'To Tinker',
            expect.anything(),
            expect.objectContaining({
                enableCommandUris: true,
            }),
        )
    })
})

describe('result view rendering', () => {
    it('renders a contextual document title for selected code runs', async () => {
        const html = await renderResultView(
            {
                status: 'success',
                summary: {
                    filePath: '/tmp/demo.php',
                    mode: 'selection',
                    rootPath: '/tmp',
                    sandboxEnabled: true,
                },
            },
            {
                name: 'To Tinker',
                version: '0.1.1',
            },
        )

        expect(html).toContain(
            '<title>Success · Selected Code · demo.php</title>',
        )
    })

    it('renders user-facing mode labels instead of internal values', async () => {
        const html = await renderResultView({
            status: 'success',
            summary: {
                filePath: '/tmp/demo.php',
                mode: 'selection',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        expect(html).toContain('Mode')
        expect(html).toContain('Selected Code')
        expect(html).not.toContain('>selection<')
    })

    it('renders function mode with a short target label', async () => {
        const html = await renderResultView({
            status: 'success',
            summary: {
                filePath: '/tmp/helpers.php',
                functionName: 'build_report',
                mode: 'function',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        expect(html).toContain('Function')
        expect(html).toContain('Target')
        expect(html).toContain('build_report')
    })

    it('renders distinct sandbox chip states', async () => {
        const sandboxedHtml = await renderResultView({
            status: 'success',
            summary: {
                filePath: '/tmp/demo.php',
                mode: 'file',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })
        const unsafeHtml = await renderResultView({
            status: 'success',
            summary: {
                filePath: '/tmp/demo.php',
                mode: 'file',
                rootPath: '/tmp',
                sandboxEnabled: false,
            },
        })

        expect(sandboxedHtml).toContain('class="chip chip-muted"')
        expect(sandboxedHtml).toContain('dry run')
        expect(unsafeHtml).toContain('class="chip chip-alert"')
        expect(unsafeHtml).toContain('⚠ real execution')
    })

    it('renders output type links for external docs', async () => {
        const html = await renderResultView({
            result: '{}',
            status: 'success',
            summary: {
                filePath: '/tmp/demo.php',
                mode: 'selection',
                outputDocUrl:
                    'https://api.laravel.com/docs/12.x/Illuminate/Support/Collection.html',
                outputTypeLabel: 'Illuminate\\Support\\Collection',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        expect(html).toContain('Output')
        expect(html).toContain('Illuminate\\Support\\Collection')
        expect(html).toContain('command:toTinker.openResultTypeLink?')
    })

    it('renders output type links for local app classes', async () => {
        const html = await renderResultView({
            result: '{}',
            status: 'success',
            summary: {
                filePath: '/tmp/demo.php',
                mode: 'selection',
                outputLocalFile: '/tmp/app/Models/User.php',
                outputTypeLabel: 'App\\Models\\User',
                rootPath: '/tmp',
                sandboxEnabled: true,
            },
        })

        expect(html).toContain('App\\Models\\User')
        expect(html).toContain('command:toTinker.openResultTypeLink?')
    })
})
