import * as path from 'node:path'
import * as vscode from 'vscode'

export function createTextDocument(
    text: string,
    fsPath = path.join('/tmp', 'sample.php'),
    options?: {
        isDirty?: boolean
        save?: () => Thenable<boolean>
    },
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
        isDirty: options?.isDirty ?? false,
        languageId: 'php',
        lineAt(line: number): vscode.TextLine {
            const lines = text.split('\n')
            return {
                lineNumber: line,
                range: new vscode.Range(
                    new vscode.Position(line, 0),
                    new vscode.Position(line, lines[line]?.length ?? 0),
                ),
                rangeIncludingLineBreak: new vscode.Range(
                    new vscode.Position(line, 0),
                    new vscode.Position(line, lines[line]?.length ?? 0),
                ),
                text: lines[line] ?? '',
            } as vscode.TextLine
        },
        lineCount: text.split('\n').length,
        offsetAt(position: vscode.Position): number {
            return offsetAt(text, position)
        },
        positionAt(offset: number): vscode.Position {
            return positionAt(text, offset)
        },
        save: options?.save ?? (async () => true),
        uri: vscode.Uri.file(fsPath),
    } as vscode.TextDocument
}

export function createCursorSelection(
    position: vscode.Position,
): vscode.Selection {
    return new vscode.Selection(position, position)
}

export function createSelection(
    start: vscode.Position,
    end: vscode.Position,
): vscode.Selection {
    return new vscode.Selection(start, end)
}

export function createCursorEditor(
    document: vscode.TextDocument,
    position: vscode.Position,
) {
    const selection = createCursorSelection(position)
    return {
        document,
        selection,
        selections: [selection],
    }
}

export function createSelectionEditor(
    document: vscode.TextDocument,
    start: vscode.Position,
    end: vscode.Position,
) {
    const selection = createSelection(start, end)
    return {
        document,
        selection,
        selections: [selection],
    }
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
