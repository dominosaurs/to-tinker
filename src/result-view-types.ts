export interface AppInfo {
    name: string
    version: string
}

export interface RunSummary {
    mode: string
    filePath: string
    rootPath: string
    phpExecutable?: string
    sandboxEnabled: boolean
    sourceCode?: string
    displaySourceCode?: string
    sourceLineStart?: number
    sourceLineEnd?: number
    className?: string
    methodName?: string
    functionName?: string
}

export interface RunReport {
    summary: RunSummary
    status: 'running' | 'success' | 'error' | 'timeout'
    result?: string
    error?: string
    diagnostics?: string
    stderr?: string
}
