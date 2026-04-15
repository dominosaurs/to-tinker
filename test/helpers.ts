import * as path from 'node:path'
import * as vscode from 'vscode'

export function createTextDocument(
    text: string,
    fsPath = path.join('/tmp', 'sample.php'),
): vscode.TextDocument {
    return {
        getText(range?: vscode.Range | vscode.Selection): string {
            if (!range) {
                return text
            }

            const start = offsetAt(text, range.start)
            const end = offsetAt(text, range.end)
            return text.slice(start, end)
        },
        languageId: 'php',
        offsetAt(position: vscode.Position): number {
            return offsetAt(text, position)
        },
        uri: vscode.Uri.file(fsPath),
    } as vscode.TextDocument
}

function offsetAt(text: string, position: vscode.Position): number {
    const lines = text.split('\n')
    let offset = 0

    for (let index = 0; index < position.line; index += 1) {
        offset += (lines[index]?.length ?? 0) + 1
    }

    return offset + position.character
}
