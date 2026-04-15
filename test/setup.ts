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
    registerTextDocumentContentProvider: vi.fn(() => ({ dispose: vi.fn() })),
}

const window = {
    activeTextEditor: undefined,
    createOutputChannel: vi.fn(() => outputChannel),
    showErrorMessage: vi.fn(),
    showInputBox: vi.fn(),
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
    Position,
    Selection,
    Uri: {
        file: (fsPath: string) => ({ fsPath }),
        parse: (value: string) => ({ fsPath: value, toString: () => value }),
    },
    window,
    workspace,
}))
