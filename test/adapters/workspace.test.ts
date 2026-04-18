import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { resolveLaravelWorkspace } from '../../src/workspace'
import { createTextDocument } from '../helpers'

describe('resolveLaravelWorkspace', () => {
    const tempRoots: string[] = []

    afterEach(() => {
        vi.restoreAllMocks()

        for (const tempRoot of tempRoots) {
            fs.rmSync(tempRoot, { force: true, recursive: true })
        }

        tempRoots.length = 0
    })

    it('finds artisan by walking up from active file', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'to-tinker-'))
        tempRoots.push(root)
        fs.mkdirSync(path.join(root, 'app', 'Services'), { recursive: true })
        fs.writeFileSync(path.join(root, 'artisan'), '')

        const documentPath = path.join(root, 'app', 'Services', 'Runner.php')
        const document = createTextDocument('<?php', documentPath)
        const workspaceFolder = {
            index: 0,
            name: 'demo',
            uri: vscode.Uri.file(root),
        } satisfies vscode.WorkspaceFolder

        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(
            workspaceFolder,
        )

        const workspace = resolveLaravelWorkspace(document)

        expect(workspace.rootPath).toBe(root)
        expect(workspace.artisanPath).toBe(path.join(root, 'artisan'))
    })
})
