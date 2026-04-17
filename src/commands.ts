export const COMMANDS = {
    openResultTypeLink: 'toTinker.openResultTypeLink',
    runDefault: 'toTinker.runDefault',
    runFile: 'toTinker.runFile',
    runFunctionAt: 'toTinker.runFunctionAt',
    runMethodAt: 'toTinker.runMethodAt',
    showLogs: 'toTinker.showLogs',
    toggleSandbox: 'toTinker.toggleSandbox',
} as const

export type RunMode = 'selection' | 'file' | 'line' | 'method' | 'function'
