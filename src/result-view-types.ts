export interface RunSummary {
    mode: string
    filePath: string
    rootPath: string
    phpExecutable?: string
    sandboxEnabled: boolean
    sourceCode?: string
    sourceLineStart?: number
    sourceLineEnd?: number
    className?: string
    methodName?: string
}

export interface RunReport {
    summary: RunSummary
    status: 'running' | 'success' | 'error' | 'timeout'
    result?: string
    error?: string
    diagnostics?: string
    stderr?: string
}
