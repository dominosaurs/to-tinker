import type * as vscode from 'vscode'

export function validateRunnableDocument(document: vscode.TextDocument): void {
    if (document.languageId !== 'php') {
        throw new Error('Active editor must be a PHP file.')
    }
}
