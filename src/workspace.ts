import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'

export interface LaravelWorkspace {
    workspaceFolder: vscode.WorkspaceFolder
    rootPath: string
    artisanPath: string
}

export function resolveLaravelWorkspace(
    document: vscode.TextDocument,
): LaravelWorkspace {
    if (document.languageId !== 'php') {
        throw new Error('Active editor must be a PHP file.')
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
    if (!workspaceFolder) {
        throw new Error('Active PHP file must belong to a workspace folder.')
    }

    const folderPath = workspaceFolder.uri.fsPath
    const documentPath = document.uri.fsPath
    const startDirectory = path.dirname(documentPath)

    for (const currentPath of walkUp(startDirectory, folderPath)) {
        const artisanPath = path.join(currentPath, 'artisan')
        if (fs.existsSync(artisanPath)) {
            return {
                artisanPath,
                rootPath: currentPath,
                workspaceFolder,
            }
        }
    }

    throw new Error(
        `No Laravel artisan file found from ${documentPath} up to workspace root ${folderPath}.`,
    )
}

function* walkUp(fromPath: string, stopPath: string): Generator<string> {
    let current = path.resolve(fromPath)
    const boundary = path.resolve(stopPath)

    while (true) {
        yield current

        if (current === boundary) {
            return
        }

        const parent = path.dirname(current)
        if (parent === current) {
            return
        }

        current = parent
    }
}
