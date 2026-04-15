import { vi } from "vitest";

class Position {
  constructor(
    public line: number,
    public character: number,
  ) {}
}

class Selection {
  public readonly isEmpty: boolean;
  public readonly active: Position;

  constructor(
    public start: Position,
    public end: Position,
  ) {
    this.active = end;
    this.isEmpty = start.line === end.line && start.character === end.character;
  }
}

const outputChannel = {
  appendLine: vi.fn(),
  clear: vi.fn(),
  show: vi.fn(),
  dispose: vi.fn(),
};

const workspace = {
  getWorkspaceFolder: vi.fn(),
  registerTextDocumentContentProvider: vi.fn(() => ({ dispose: vi.fn() })),
  getConfiguration: vi.fn(() => ({
    get: (_key: string, defaultValue?: unknown) => defaultValue,
  })),
};

const window = {
  activeTextEditor: undefined,
  createOutputChannel: vi.fn(() => outputChannel),
  showErrorMessage: vi.fn(),
  showInputBox: vi.fn(),
};

const commands = {
  executeCommand: vi.fn(),
  registerCommand: vi.fn((_command: string, callback: () => unknown) => ({
    dispose: vi.fn(),
    callback,
  })),
};

class EventEmitter<T> {
  public readonly event = vi.fn();

  fire(_value: T): void {}

  dispose(): void {}
}

vi.mock("vscode", () => ({
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    parse: (value: string) => ({ fsPath: value, toString: () => value }),
  },
  EventEmitter,
  Position,
  Selection,
  workspace,
  window,
  commands,
}));
