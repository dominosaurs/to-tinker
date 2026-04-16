import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { prepareExecutionEnvironment } from '../src/preflight'
import { createTextDocument } from './helpers'

describe('prepareExecutionEnvironment', () => {
    it('fails early for non-php documents', () => {
        const document = {
            ...createTextDocument('console.log(1)', '/tmp/demo.js'),
            languageId: 'javascript',
        } as vscode.TextDocument

        expect(() => prepareExecutionEnvironment(document)).toThrow(
            'Active editor must be a PHP file.',
        )
    })

    it('returns workspace and php executable for runnable php documents', () => {
        const root = fs.mkdtempSync(
            path.join(os.tmpdir(), 'to-tinker-preflight-'),
        )
        fs.mkdirSync(path.join(root, 'app'), { recursive: true })
        fs.writeFileSync(path.join(root, 'artisan'), '')
        const document = createTextDocument(
            '<?php\n$foo = 1;',
            path.join(root, 'app', 'demo.php'),
        )
        const workspaceFolder = {
            index: 0,
            name: 'demo',
            uri: vscode.Uri.file(root),
        } satisfies vscode.WorkspaceFolder

        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(
            workspaceFolder,
        )
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: (_key: string, defaultValue?: unknown) => defaultValue,
        } as ReturnType<typeof vscode.workspace.getConfiguration>)

        try {
            expect(prepareExecutionEnvironment(document)).toEqual({
                phpExecutable: 'php',
                workspace: {
                    artisanPath: path.join(root, 'artisan'),
                    rootPath: root,
                    workspaceFolder,
                },
            })
        } finally {
            fs.rmSync(root, { force: true, recursive: true })
        }
    })
})
