import { vi } from 'vitest'

class Position {
    constructor(
        public line: number,
        public character: number,
    ) {}
}

class Selection {
    public readonly isEmpty: boolean
    public readonly active: Position

    constructor(
        public start: Position,
        public end: Position,
    ) {
        this.active = end
        this.isEmpty =
            start.line === end.line && start.character === end.character
    }
}

const outputChannel = {
    appendLine: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    show: vi.fn(),
}

const workspace = {
    getConfiguration: vi.fn(() => ({
        get: (_key: string, defaultValue?: unknown) => defaultValue,
    })),
    getWorkspaceFolder: vi.fn(),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    openTextDocument: vi.fn(async (uri: { fsPath: string }) => ({ uri })),
    registerTextDocumentContentProvider: vi.fn(() => ({ dispose: vi.fn() })),
}

const languages = {
    registerCodeLensProvider: vi.fn(() => ({ dispose: vi.fn() })),
}

const window = {
    activeTextEditor: undefined,
    createOutputChannel: vi.fn(() => outputChannel),
    createWebviewPanel: vi.fn(() => ({
        dispose: vi.fn(),
        onDidDispose: vi.fn(),
        reveal: vi.fn(),
        webview: { html: '' },
    })),
    showErrorMessage: vi.fn(),
    showInputBox: vi.fn(),
    visibleTextEditors: [],
}

const commands = {
    executeCommand: vi.fn(),
    registerCommand: vi.fn((_command: string, callback: () => unknown) => ({
        callback,
        dispose: vi.fn(),
    })),
}

class EventEmitter<T> {
    public readonly event = vi.fn()

    fire(_value: T): void {}

    dispose(): void {}
}

vi.mock('vscode', () => ({
    commands,
    EventEmitter,
    languages,
    Position,
    Selection,
    Uri: {
        file: (fsPath: string) => ({ fsPath }),
        parse: (value: string) => ({ fsPath: value, toString: () => value }),
    },
    ViewColumn: { Beside: 2 },
    window,
    workspace,
}))
