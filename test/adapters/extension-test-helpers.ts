import { expect } from 'vitest'
import type * as vscode from 'vscode'
import { commands, window } from '../vscode'

export async function activateExtension(): Promise<void> {
    const { activate } = await import('../../src/extension')
    const context = {
        subscriptions: [],
    } as unknown as vscode.ExtensionContext
    activate(context)
}

export function setActiveEditor(editor: {
    document: vscode.TextDocument
    selection: vscode.Selection
    selections: vscode.Selection[]
}): void {
    window.activeTextEditor = editor as unknown as vscode.TextEditor
}

export async function runCommand(
    command: string,
    ...args: unknown[]
): Promise<void> {
    await getRegisteredCommand(command)(...args)
}

export async function activateAndRunCommand(
    command: string,
    ...args: unknown[]
): Promise<void> {
    await activateExtension()
    await runCommand(command, ...args)
}

export function expectLastExecutionMode(
    executeTinker: (...args: unknown[]) => unknown,
    mode: 'file' | 'line' | 'selection',
): void {
    expect(executeTinker).toHaveBeenCalledWith(
        expect.objectContaining({ mode }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
    )
}

export function getRegisteredCommand(
    command: string,
): (...args: unknown[]) => Promise<void> {
    const registered = commands.registerCommand.mock.calls.find(
        ([name]) => name === command,
    )

    if (!registered) {
        throw new Error(`Missing registered command: ${command}`)
    }

    return registered[1] as (...args: unknown[]) => Promise<void>
}
