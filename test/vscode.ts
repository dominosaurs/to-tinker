import { vi } from 'vitest'

export class Position {
    constructor(
        public line: number,
        public character: number,
    ) {}
}

export class Range {
    constructor(
        public start: Position,
        public end: Position,
    ) {}
}

export class Selection extends Range {
    public readonly isEmpty: boolean
    public readonly active: Position

    constructor(start: Position, end: Position) {
        super(start, end)
        this.active = end
        this.isEmpty =
            start.line === end.line && start.character === end.character
    }
}

export class CodeLens {
    constructor(
        public range: Range,
        public command?: {
            arguments?: unknown[]
            command: string
            title: string
        },
    ) {}
}

export class EventEmitter<T> {
    public readonly event = vi.fn()

    fire(_value: T): void {}

    dispose(): void {}
}

const outputChannel = {
    appendLine: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    show: vi.fn(),
}

export const commands = {
    executeCommand: vi.fn(),
    registerCommand: vi.fn((_command: string, callback: () => unknown) => ({
        callback,
        dispose: vi.fn(),
    })),
}

export const languages = {
    registerCodeLensProvider: vi.fn(() => ({ dispose: vi.fn() })),
}

export const window = {
    activeTextEditor: undefined as unknown,
    createOutputChannel: vi.fn(() => outputChannel),
    createWebviewPanel: vi.fn(() => ({
        dispose: vi.fn(),
        onDidDispose: vi.fn(),
        reveal: vi.fn(),
        webview: { html: '' },
    })),
    onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showInputBox: vi.fn(),
    visibleTextEditors: [] as unknown[],
}

export const workspace = {
    getConfiguration: vi.fn(() => ({
        get: (_key: string, defaultValue?: unknown) => defaultValue,
        update: vi.fn(),
    })),
    getWorkspaceFolder: vi.fn(),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    openTextDocument: vi.fn(async (uri: { fsPath: string }) => ({ uri })),
    registerTextDocumentContentProvider: vi.fn(() => ({ dispose: vi.fn() })),
    workspaceFolders: [] as unknown[],
}

export const Uri = {
    file: (fsPath: string) => ({ fsPath, toString: () => fsPath }),
    parse: (value: string) => ({ fsPath: value, toString: () => value }),
}

export const ViewColumn = { Beside: 2 }
export const ConfigurationTarget = {
    Global: 1,
    Workspace: 2,
}
