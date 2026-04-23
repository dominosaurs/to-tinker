export const COMMANDS = {
    doctor: 'toTinker.doctor',
    openResultTypeLink: 'toTinker.openResultTypeLink',
    resetDisclaimer: 'toTinker.resetDisclaimer',
    runDefault: 'toTinker.runDefault',
    runFile: 'toTinker.runFile',
    runFunctionAt: 'toTinker.runFunctionAt',
    runMethodAt: 'toTinker.runMethodAt',
    showLogs: 'toTinker.showLogs',
    toggleSandbox: 'toTinker.toggleSandbox',
} as const

export type RunMode = 'selection' | 'file' | 'line' | 'method' | 'function'
