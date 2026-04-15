export const COMMANDS = {
    runFile: 'toTinker.runFile',
    runFileDisableSandbox: 'toTinker.runFileDisableSandbox',
    runMethod: 'toTinker.runMethod',
    runMethodAt: 'toTinker.runMethodAt',
    runMethodDisableSandbox: 'toTinker.runMethodDisableSandbox',
    runPrimary: 'toTinker.runPrimary',
    runSelection: 'toTinker.runSelection',
    runSelectionDisableSandbox: 'toTinker.runSelectionDisableSandbox',
    showLogs: 'toTinker.showLogs',
} as const

export type CommandName = keyof typeof COMMANDS

export type RunKind = 'selection' | 'file' | 'method'
