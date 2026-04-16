export const COMMANDS = {
    runDefault: 'toTinker.runDefault',
    runFile: 'toTinker.runFile',
    runFunctionAt: 'toTinker.runFunctionAt',
    runMethodAt: 'toTinker.runMethodAt',
    showLogs: 'toTinker.showLogs',
    toggleSandbox: 'toTinker.toggleSandbox',
} as const

export type CommandName = keyof typeof COMMANDS

export type RunMode = 'selection' | 'file' | 'line' | 'method' | 'function'
