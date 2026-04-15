export const COMMANDS = {
    runFile: 'toTinker.runFile',
    runLine: 'toTinker.runLine',
    runMethod: 'toTinker.runMethod',
    runMethodAt: 'toTinker.runMethodAt',
    runPrimary: 'toTinker.runPrimary',
    runSelection: 'toTinker.runSelection',
    showLogs: 'toTinker.showLogs',
    toggleSandbox: 'toTinker.toggleSandbox',
} as const

export type CommandName = keyof typeof COMMANDS

export type RunKind = 'selection' | 'file' | 'line' | 'method'
