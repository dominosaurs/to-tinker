import * as path from 'node:path'
import {
    createBundledHighlighter,
    createSingletonShorthands,
} from '@shikijs/core'
import jsonLanguage from '@shikijs/langs/json'
import phpLanguage from '@shikijs/langs/php'
import githubDarkTheme from '@shikijs/themes/github-dark'
import githubLightTheme from '@shikijs/themes/github-light'
import type { ComponentChildren, JSX } from 'preact'
import renderToString from 'preact-render-to-string'
import type { ThemedTokenWithVariants } from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { RunReport } from './result-view-types'

const shiki = createSingletonShorthands(
    createBundledHighlighter({
        engine: createJavaScriptRegexEngine,
        langs: {
            json: async () => jsonLanguage,
            php: async () => phpLanguage,
        },
        themes: {
            dark: async () => githubDarkTheme,
            light: async () => githubLightTheme,
        },
    }),
)

type HighlightLanguage = 'json' | 'php' | 'text'

interface HighlightToken {
    content: string
    darkColor?: string
    lightColor?: string
    bold?: boolean
    italic?: boolean
    strike?: boolean
    underline?: boolean
}

interface HighlightLine {
    tokens: HighlightToken[]
}

interface ViewModel {
    elapsed?: string
    error?: string
    fileLabel: string
    kind: string
    nextSteps: string[]
    notice?: string
    output?: HighlightLine[]
    phpLabel?: string
    rootLabel: string
    sandboxLabel: string
    source?: HighlightLine[]
    sourceLineStart?: number
    statusLabel: string
    targetLabel: string
}

export async function renderResultView(report: RunReport): Promise<string> {
    const view = await toViewModel(report)

    return `<!DOCTYPE html>${renderToString(<Document view={view} />)}`
}

async function toViewModel(report: RunReport): Promise<ViewModel> {
    const { summary } = report
    const diagnostics = [report.diagnostics?.trim(), report.stderr?.trim()]
        .filter(Boolean)
        .join('\n')

    return {
        elapsed: extractElapsed(diagnostics),
        error: report.error,
        fileLabel: `${shortPath(summary.filePath, summary.rootPath)}${formatLineRange(summary.sourceLineStart, summary.sourceLineEnd)}`,
        kind: summary.kind,
        nextSteps: buildNextSteps(report, diagnostics),
        notice: stripElapsed(diagnostics) || undefined,
        output: report.result
            ? await highlightLines(
                  report.result,
                  detectLanguage(summary.kind, report.result, false),
              )
            : undefined,
        phpLabel: summary.phpExecutable,
        rootLabel: summary.rootPath,
        sandboxLabel: summary.sandboxEnabled ? 'sandbox' : 'no sandbox',
        source: summary.sourceCode
            ? await highlightLines(summary.sourceCode, 'php')
            : undefined,
        sourceLineStart: summary.sourceLineStart,
        statusLabel: report.status === 'success' ? 'success' : report.status,
        targetLabel:
            summary.kind === 'method' && summary.methodName
                ? `${summary.className ?? '?'}::${summary.methodName}`
                : path.basename(summary.filePath),
    }
}

function Document({ view }: { view: ViewModel }): JSX.Element {
    return (
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta
                    content="width=device-width, initial-scale=1.0"
                    name="viewport"
                />
                <title>To Tinker</title>
                <style>{styles()}</style>
            </head>
            <body>
                <Header view={view} />
                {view.nextSteps.length > 0 ? (
                    <Section title="Next">
                        <ul class="tips">
                            {view.nextSteps.map(step => (
                                <li>{step}</li>
                            ))}
                        </ul>
                    </Section>
                ) : null}
                {view.output ? (
                    <Section title="Output">
                        <div class="block result">
                            <HighlightedPre lines={view.output} />
                        </div>
                    </Section>
                ) : null}
                {view.source ? (
                    <details>
                        <summary>Source</summary>
                        <div class="block">
                            <CodeBlock
                                lines={view.source}
                                startLine={view.sourceLineStart ?? 1}
                            />
                        </div>
                    </details>
                ) : null}
                {view.error ? (
                    <Section title="Error">
                        <div class="block">
                            <pre>{view.error}</pre>
                        </div>
                    </Section>
                ) : null}
                {view.notice ? <div class="notice">{view.notice}</div> : null}
            </body>
        </html>
    )
}

function Header({ view }: { view: ViewModel }): JSX.Element {
    return (
        <div class="top">
            <div class="status-line">
                <span class="chip chip-muted">{view.sandboxLabel}</span>
                <span class="chip chip-muted">{capitalize(view.kind)}</span>
                <span class={`status-${view.statusLabel}`}>
                    {view.statusLabel}
                </span>
                {view.elapsed ? (
                    <span class="elapsed">{view.elapsed}</span>
                ) : null}
            </div>
            <KindTabs activeKind={view.kind} />
            <div class="meta-grid">
                <Meta label="Target" value={view.targetLabel} />
                <Meta label="File" value={view.fileLabel} />
                <Meta label="Workspace Root" value={view.rootLabel} />
                {view.phpLabel ? (
                    <Meta label="PHP" value={view.phpLabel} />
                ) : null}
            </div>
        </div>
    )
}

function Meta({ label, value }: { label: string; value: string }): JSX.Element {
    return (
        <div class="meta-item">
            <span class="meta-label">{label}</span>
            <span class="meta-value">{value}</span>
        </div>
    )
}

function KindTabs({ activeKind }: { activeKind: string }): JSX.Element {
    const kinds = ['file', 'method', 'selection']

    return (
        <>
            {kinds.map((kind, index) => (
                <SpanGroup key={kind}>
                    {index > 0 ? <span class="kind"> | </span> : null}
                    <span class={kind === activeKind ? 'kind-active' : 'kind'}>
                        {capitalize(kind)}
                    </span>
                </SpanGroup>
            ))}
        </>
    )
}

function Section({
    children,
    title,
}: {
    children: ComponentChildren
    title: string
}): JSX.Element {
    return (
        <>
            <h2>{title}</h2>
            {children}
        </>
    )
}

function HighlightedPre({ lines }: { lines: HighlightLine[] }): JSX.Element {
    return (
        <pre>
            {lines.map((line, index) => (
                <SpanGroup key={index}>
                    {index > 0 ? '\n' : null}
                    <TokenLine tokens={line.tokens} />
                </SpanGroup>
            ))}
        </pre>
    )
}

function CodeBlock({
    lines,
    startLine,
}: {
    lines: HighlightLine[]
    startLine: number
}): JSX.Element {
    return (
        <div class="code-lines">
            {lines.map((line, index) => (
                <div class="line" key={startLine + index}>
                    <span class="ln">{startLine + index}</span>
                    <span class="code-cell">
                        <TokenLine tokens={line.tokens} />
                    </span>
                </div>
            ))}
        </div>
    )
}

function TokenLine({ tokens }: { tokens: HighlightToken[] }): JSX.Element {
    if (tokens.length === 0) {
        return <>{'\u00a0'}</>
    }

    return (
        <span
            dangerouslySetInnerHTML={{
                __html: tokens.map(renderTokenHtml).join('') || '&nbsp;',
            }}
        />
    )
}

function SpanGroup({ children }: { children: ComponentChildren }): JSX.Element {
    return <>{children}</>
}

async function highlightLines(
    value: string,
    language: HighlightLanguage,
): Promise<HighlightLine[]> {
    if (!value) {
        return [{ tokens: [createPlainToken(' ')] }]
    }

    if (language === 'text') {
        return value.split('\n').map(line => ({
            tokens: [createPlainToken(line || ' ')],
        }))
    }

    try {
        const lines = await shiki.codeToTokensWithThemes(value, {
            grammarContextCode: language === 'php' ? '<?php\n' : undefined,
            lang: language,
            themes: {
                dark: githubDarkTheme,
                light: githubLightTheme,
            },
        })

        return lines.length > 0
            ? lines.map(line => ({
                  tokens:
                      line.length > 0
                          ? line.map(mapToken)
                          : [createPlainToken(' ')],
              }))
            : [{ tokens: [createPlainToken(' ')] }]
    } catch {
        return value.split('\n').map(line => ({
            tokens: [createPlainToken(line || ' ')],
        }))
    }
}

function mapToken(token: ThemedTokenWithVariants): HighlightToken {
    const light = token.variants.light ?? {}
    const dark = token.variants.dark ?? {}
    const fontStyle = light.fontStyle ?? dark.fontStyle ?? 0

    return {
        bold: Boolean(fontStyle & 2),
        content: token.content,
        darkColor: dark.color ?? light.color,
        italic: Boolean(fontStyle & 1),
        lightColor: light.color ?? dark.color,
        strike: Boolean(fontStyle & 8),
        underline: Boolean(fontStyle & 4),
    }
}

function createPlainToken(content: string): HighlightToken {
    return { content }
}

function styles(): string {
    return `
        :root {
            color-scheme: light dark;
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --muted: var(--vscode-descriptionForeground);
            --border: var(--vscode-panel-border);
            --ok: #2f9e44;
            --error: #e03131;
            --info: #4dabf7;
            --notice: #f08c00;
            --run: #f08c00;
            --timeout: #c77dff;
            --code-bg: var(--vscode-textCodeBlock-background);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 24px;
            background: var(--bg);
            color: var(--fg);
            font: 14px/1.5 var(--vscode-font-family);
        }
        h2 {
            margin: 20px 0 10px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--muted);
        }
        .top { margin-bottom: 18px; }
        .status-line {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 4px;
        }
        .elapsed {
            color: var(--muted);
            font-size: 12px;
        }
        .chip {
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 11px;
            letter-spacing: 0.02em;
            text-transform: uppercase;
        }
        .chip-muted {
            color: var(--muted);
            background: color-mix(in srgb, var(--code-bg) 70%, transparent 30%);
        }
        .status-success { color: var(--ok); font-weight: 700; }
        .status-error { color: var(--error); font-weight: 700; }
        .status-running { color: var(--run); font-weight: 700; }
        .status-timeout { color: var(--timeout); font-weight: 700; }
        .kind { color: var(--muted); }
        .kind-active { color: var(--info); font-weight: 700; }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
            margin-top: 12px;
        }
        .meta-item {
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 10px 12px;
            background: color-mix(in srgb, var(--code-bg) 65%, transparent 35%);
        }
        .meta-label {
            display: block;
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 3px;
        }
        .meta-value {
            display: block;
            font-size: 13px;
            word-break: break-word;
        }
        .notice {
            margin-top: 18px;
            color: var(--notice);
            font-size: 12px;
        }
        .tips {
            margin: 0 0 18px;
            padding-left: 18px;
            color: var(--muted);
        }
        .tips li + li {
            margin-top: 6px;
        }
        .block {
            overflow: auto;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: var(--code-bg);
        }
        pre {
            margin: 0;
            padding: 14px 16px;
            font: 13px/1.45 var(--vscode-editor-font-family);
            white-space: pre-wrap;
            word-break: break-word;
            tab-size: 4;
        }
        .result pre { font-size: 15px; }
        details { margin-top: 20px; }
        summary {
            cursor: pointer;
            color: var(--muted);
            margin-bottom: 10px;
        }
        .code-lines {
            font: 13px/1.45 var(--vscode-editor-font-family);
            tab-size: 4;
        }
        .line {
            display: grid;
            grid-template-columns: 56px minmax(0, 1fr);
        }
        .ln {
            user-select: none;
            text-align: right;
            padding: 0 12px 0 0;
            color: var(--muted);
            border-right: 1px solid color-mix(in srgb, var(--border) 80%, transparent 20%);
            margin-right: 12px;
        }
        .code-cell {
            min-width: 0;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .tok {
            color: var(--shiki-light, inherit);
        }
        .tok[data-i="1"] { font-style: italic; }
        .tok[data-b="1"] { font-weight: 700; }
        .tok[data-u="1"] { text-decoration: underline; }
        .tok[data-s="1"] { text-decoration: line-through; }
        .vscode-dark .tok,
        .vscode-high-contrast:not(.vscode-light) .tok {
            color: var(--shiki-dark, var(--shiki-light, inherit));
        }
    `
}

function renderTokenHtml(token: HighlightToken): string {
    const attrs: string[] = ['class="tok"']
    const style = [
        token.lightColor ? `--shiki-light:${token.lightColor}` : '',
        token.darkColor ? `--shiki-dark:${token.darkColor}` : '',
    ]
        .filter(Boolean)
        .join(';')

    if (token.bold) {
        attrs.push('data-b="1"')
    }
    if (token.italic) {
        attrs.push('data-i="1"')
    }
    if (token.underline) {
        attrs.push('data-u="1"')
    }
    if (token.strike) {
        attrs.push('data-s="1"')
    }
    if (style) {
        attrs.push(`style="${escapeHtml(style)}"`)
    }

    return `<span ${attrs.join(' ')}>${escapeHtml(token.content)}</span>`
}

function shortPath(filePath: string, rootPath: string): string {
    return filePath.startsWith(rootPath)
        ? filePath.slice(rootPath.length + 1)
        : filePath
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

function detectLanguage(
    kind: string,
    value: string,
    isSource: boolean,
): HighlightLanguage {
    if (isSource || kind === 'method') {
        return 'php'
    }

    const trimmed = value.trim()
    if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
        return 'json'
    }

    return 'text'
}

function buildNextSteps(report: RunReport, diagnostics: string): string[] {
    const details = `${report.error ?? ''}\n${diagnostics}`.toLowerCase()
    const steps: string[] = []

    if (report.status === 'running') {
        return [
            'Wait for Laravel Tinker to finish, or trigger another run after the current one completes.',
        ]
    }

    if (report.status === 'timeout') {
        steps.push(
            'Increase toTinker.timeoutSeconds if this code path is expected to take longer.',
        )
        steps.push(
            'Reduce the amount of work in the selection or method to isolate the slow step.',
        )
    }

    if (details.includes('unresolved parameter')) {
        steps.push(
            'Run the method again and provide a PHP expression for each unresolved scalar parameter.',
        )
    }

    if (details.includes('uninitialized property')) {
        steps.push(
            'Prefer a method whose dependencies are fully initialized by the Laravel container, or initialize the object state before invoking it.',
        )
    }

    if (details.includes('class') && details.includes('not found')) {
        steps.push(
            'Confirm the Laravel app boots cleanly and the target class is autoloadable from the current workspace root.',
        )
    }

    if (
        details.includes('bindingresolutionexception') ||
        details.includes('target class') ||
        details.includes('unable to resolve')
    ) {
        steps.push(
            'Check container bindings and constructor dependencies for the selected method target.',
        )
    }

    if (details.includes('syntax error') || details.includes('parse error')) {
        steps.push(
            'Fix the PHP syntax in the current selection, file, or method and run it again.',
        )
    }

    if (steps.length === 0 && report.status !== 'success') {
        steps.push(
            'Inspect the diagnostics below to find the first Laravel or PHP error in the stack trace.',
        )
    }

    return steps
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}
