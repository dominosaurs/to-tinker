import * as vscode from 'vscode'

export function extractSelection(
    document: vscode.TextDocument,
    selection: vscode.Selection,
): string {
    if (selection.isEmpty) {
        throw new Error('Selection is empty. Select PHP code first.')
    }

    const text = document.getText(selection).trim()
    if (!text) {
        throw new Error('Selection is empty. Select PHP code first.')
    }

    return stripPhpTags(text)
}

export function extractFile(document: vscode.TextDocument): string {
    return stripPhpTags(document.getText())
}

export function extractPrefixToLine(
    document: vscode.TextDocument,
    position: vscode.Position,
): string {
    const line = document.lineAt(position.line)
    return stripPhpTags(
        document.getText(
            new vscode.Range(new vscode.Position(0, 0), line.range.end),
        ),
    )
}

export function extractPrefixToSelectionEnd(
    document: vscode.TextDocument,
    selection: vscode.Selection,
): string {
    return stripPhpTags(
        document.getText(
            new vscode.Range(new vscode.Position(0, 0), selection.end),
        ),
    )
}

export function extractLine(
    document: vscode.TextDocument,
    position: vscode.Position,
): string {
    const line = document.lineAt(position.line)
    const text = line.text.trim()

    if (!text) {
        throw new Error(
            'Current line is empty. Move the cursor to PHP code first.',
        )
    }

    return stripPhpTags(text)
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

export function stripPhpTags(text: string): string {
    return text
        .replace(/^<\?php\s*/u, '')
        .replace(/\?>\s*$/u, '')
        .trim()
}
