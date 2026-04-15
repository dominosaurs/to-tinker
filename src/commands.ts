export const COMMANDS = {
    runFile: 'toTinker.runFile',
    runFileDisableSandbox: 'toTinker.runFileDisableSandbox',
    runMethod: 'toTinker.runMethod',
    runMethodDisableSandbox: 'toTinker.runMethodDisableSandbox',
    runSelection: 'toTinker.runSelection',
    runSelectionDisableSandbox: 'toTinker.runSelectionDisableSandbox',
} as const

export type CommandName = keyof typeof COMMANDS

export type RunKind = 'selection' | 'file' | 'method'
