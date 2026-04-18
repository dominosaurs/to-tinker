import type { AppInfo, RunReport } from '../../result-view-types'

interface ResultViewModel {
    appLabel: string
    elapsed?: string
    error?: string
    fileLabel: string
    mode: string
    modeLabel: string
    notice?: string
    outputDocUrl?: string
    outputLocalFile?: string
    outputText?: string
    outputTypeLabel?: string
    sandboxLabel: string
    sandboxTone: 'alert' | 'muted'
    sourceLineStart?: number
    sourceText?: string
    statusClassName: string
    statusLabel: string
    targetLabel: string
    title: string
}

export function buildResultViewModel(
    report: RunReport,
    appInfo: AppInfo,
): ResultViewModel {
    const { summary } = report
    const diagnostics = [report.diagnostics?.trim(), report.stderr?.trim()]
        .filter(Boolean)
        .join('\n')

    const sandboxLabel = summary.sandboxEnabled ? 'dry run' : '⚠ real execution'
    const modeLabel = formatMode(summary.mode)

    return {
        appLabel: `${appInfo.name} v${appInfo.version}`,
        elapsed: extractElapsed(diagnostics),
        error: report.error,
        fileLabel: `${shortPath(summary.filePath, summary.rootPath)}${formatLineRange(summary.sourceLineStart, summary.sourceLineEnd)}`,
        mode: summary.mode,
        modeLabel,
        notice: stripElapsed(diagnostics) || undefined,
        outputDocUrl: summary.outputDocUrl,
        outputLocalFile: summary.outputLocalFile,
        outputText: report.result,
        outputTypeLabel: summary.outputTypeLabel,
        sandboxLabel,
        sandboxTone: summary.sandboxEnabled ? 'muted' : 'alert',
        sourceLineStart: summary.sourceLineStart,
        sourceText: summary.displaySourceCode ?? summary.sourceCode,
        statusClassName: `status-${report.status === 'success' ? 'success' : report.status}`,
        statusLabel: report.status === 'success' ? 'success' : report.status,
        targetLabel: buildTargetLabel(summary),
        title: formatDocumentTitle(
            report.status,
            summary.mode,
            summary.filePath,
        ),
    }
}

function buildTargetLabel(summary: RunReport['summary']): string {
    if (summary.mode === 'method' && summary.methodName) {
        return `${summary.className ?? '?'}::${summary.methodName}`
    }

    if (summary.mode === 'function' && summary.functionName) {
        return summary.functionName
    }

    return basename(summary.filePath)
}

function shortPath(filePath: string, rootPath: string): string {
    return filePath.startsWith(rootPath)
        ? filePath.slice(rootPath.length + 1)
        : filePath
}

function basename(filePath: string): string {
    const normalized = filePath.replaceAll('\\', '/')
    return normalized.split('/').at(-1) || filePath
}

function extractElapsed(value: string): string | undefined {
    const match = value.match(/elapsed_ms=(\d+)/)
    return match ? `${match[1]} ms` : undefined
}

function stripElapsed(value: string): string {
    return value.replace(/(^|\n)elapsed_ms=\d+(\n|$)/g, '\n').trim()
}

function formatLineRange(start?: number, end?: number): string {
    if (!start) {
        return ''
    }

    if (!end || end === start) {
        return `:${start}`
    }

    return `:${start}-${end}`
}

export function formatMode(value: string): string {
    switch (value) {
        case 'selection':
            return 'Selected Code'
        case 'line':
            return 'Line'
        case 'file':
            return 'File'
        case 'method':
            return 'Method'
        case 'function':
            return 'Function'
        default:
            return value.charAt(0).toUpperCase() + value.slice(1)
    }
}

function formatDocumentTitle(
    status: RunReport['status'],
    mode: string,
    filePath: string,
): string {
    const statusLabel = status === 'success' ? 'Success' : formatMode(status)
    return `${statusLabel} · ${formatMode(mode)} · ${basename(filePath)}`
}
