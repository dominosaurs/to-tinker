import { beforeEach, vi } from 'vitest'
import { window, workspace } from './vscode'

beforeEach(() => {
    vi.clearAllMocks()
    window.activeTextEditor = undefined
    window.visibleTextEditors = []
    workspace.getWorkspaceFolder.mockReset()
    workspace.workspaceFolders = []
    workspace.getConfiguration.mockImplementation(() => ({
        get: (_key: string, defaultValue?: unknown) => defaultValue,
        update: vi.fn(),
    }))
})
