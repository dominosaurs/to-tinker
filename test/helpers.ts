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
        lineCount: text.split('\n').length,
        offsetAt(position: vscode.Position): number {
            return offsetAt(text, position)
        },
        positionAt(offset: number): vscode.Position {
            return positionAt(text, offset)
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

function positionAt(text: string, offset: number): vscode.Position {
    const normalizedOffset = Math.max(0, Math.min(offset, text.length))
    const lines = text.split('\n')
    let remaining = normalizedOffset

    for (let index = 0; index < lines.length; index += 1) {
        const lineLength = lines[index]?.length ?? 0
        if (remaining <= lineLength) {
            return new vscode.Position(index, remaining)
        }

        remaining -= lineLength + 1
    }

    return new vscode.Position(lines.length - 1, lines.at(-1)?.length ?? 0)
}
