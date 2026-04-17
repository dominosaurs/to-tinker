import type * as vscode from 'vscode'

export function extractSelection(
    document: vscode.TextDocument,
    selection: vscode.Selection,
): string {
    return extractSelectionFromText(
        document.getText(),
        document.offsetAt(selection.start),
        document.offsetAt(selection.end),
    )
}

export function extractSelectionFromText(
    text: string,
    startOffset: number,
    endOffset: number,
): string {
    if (startOffset === endOffset) {
        throw new Error('Selection is empty. Select PHP code first.')
    }

    const selectedText = text.slice(startOffset, endOffset).trim()
    if (!selectedText) {
        throw new Error('Selection is empty. Select PHP code first.')
    }

    return stripPhpTags(selectedText)
}

export function extractFile(document: vscode.TextDocument): string {
    return extractFileFromText(document.getText())
}

export function extractFileFromText(text: string): string {
    return stripPhpTags(text)
}

export function extractLine(
    document: vscode.TextDocument,
    position: vscode.Position,
): string {
    return extractLineFromText(document.getText(), position.line)
}

function extractLineFromText(text: string, lineNumber: number): string {
    const { end, start } = lineBoundsAt(text, lineNumber)
    const lineText = text.slice(start, end).trim()

    if (!lineText) {
        throw new Error(
            'Current line is empty. Move the cursor to PHP code first.',
        )
    }

    return stripPhpTags(lineText)
}

export function lineNumberAtOffset(text: string, offset: number): number {
    let lineNumber = 0

    for (let index = 0; index < Math.min(offset, text.length); index += 1) {
        if (text[index] === '\n') {
            lineNumber += 1
        }
    }

    return lineNumber
}

export function lineEndOffset(text: string, lineNumber: number): number {
    return lineBoundsAt(text, lineNumber).end
}

export function trimWhitespaceBounds(
    text: string,
    start: number,
    end: number,
): [number, number] {
    let trimmedStart = start
    let trimmedEnd = end

    while (trimmedStart < trimmedEnd && /\s/.test(text[trimmedStart] ?? '')) {
        trimmedStart += 1
    }

    while (trimmedEnd > trimmedStart && /\s/.test(text[trimmedEnd - 1] ?? '')) {
        trimmedEnd -= 1
    }

    return [trimmedStart, trimmedEnd]
}

function stripPhpTags(text: string): string {
    return text
        .replace(/^<\?php\s*/u, '')
        .replace(/\?>\s*$/u, '')
        .trim()
}

function lineBoundsAt(
    text: string,
    lineNumber: number,
): { start: number; end: number } {
    let currentLine = 0
    let start = 0

    for (let index = 0; index < text.length; index += 1) {
        if (currentLine === lineNumber) {
            const end = text.indexOf('\n', index)
            return {
                end: end === -1 ? text.length : end,
                start,
            }
        }

        if (text[index] === '\n') {
            currentLine += 1
            start = index + 1
        }
    }

    if (currentLine === lineNumber) {
        return {
            end: text.length,
            start,
        }
    }

    return {
        end: text.length,
        start: text.length,
    }
}
