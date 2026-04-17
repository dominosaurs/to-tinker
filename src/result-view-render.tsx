import type { ComponentChildren, JSX } from 'preact'
import renderToString from 'preact-render-to-string'
import { buildResultViewModel } from './core/present/result-view-model'
import type {
    HighlightLanguage,
    HighlightLine,
    HighlightToken,
} from './result-view-highlighter'
import type { AppInfo, RunReport } from './result-view-types'

let resultViewHighlighterModulePromise:
    | Promise<typeof import('./result-view-highlighter')>
    | undefined

function loadResultViewHighlighterModule(): Promise<
    typeof import('./result-view-highlighter')
> {
    if (!resultViewHighlighterModulePromise) {
        resultViewHighlighterModulePromise = import('./result-view-highlighter')
    }

    return resultViewHighlighterModulePromise
}

interface ViewModel {
    appLabel: string
    elapsed?: string
    error?: string
    fileLabel: string
    mode: string
    modeLabel: string
    notice?: string
    output?: HighlightLine[]
    sandboxLabel: string
    sandboxTone: 'alert' | 'muted'
    source?: HighlightLine[]
    sourceLineStart?: number
    statusClassName: string
    statusLabel: string
    targetLabel: string
    title: string
}

export async function renderResultView(
    report: RunReport,
    appInfo: AppInfo = {
        name: 'To Tinker',
        version: 'dev',
    },
): Promise<string> {
    const view = await toViewModel(report, appInfo)

    return `<!DOCTYPE html>${renderToString(<Document view={view} />)}`
}

async function toViewModel(
    report: RunReport,
    appInfo: AppInfo,
): Promise<ViewModel> {
    const model = buildResultViewModel(report, appInfo)

    return {
        appLabel: model.appLabel,
        elapsed: model.elapsed,
        error: model.error,
        fileLabel: model.fileLabel,
        mode: model.mode,
        modeLabel: model.modeLabel,
        notice: model.notice,
        output: model.outputText
            ? await highlightLines(
                  model.outputText,
                  detectLanguage(model.mode, model.outputText, false),
              )
            : undefined,
        sandboxLabel: model.sandboxLabel,
        sandboxTone: model.sandboxTone,
        source: model.sourceText
            ? await highlightLines(model.sourceText, 'php')
            : undefined,
        sourceLineStart: model.sourceLineStart,
        statusClassName: model.statusClassName,
        statusLabel: model.statusLabel,
        targetLabel: model.targetLabel,
        title: model.title,
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
                <title>{view.title}</title>
                <style>{styles()}</style>
            </head>
            <body>
                <Header view={view} />
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

                {view.output ? (
                    <Section title="Output">
                        <div class="block result">
                            <HighlightedPre lines={view.output} />
                        </div>
                    </Section>
                ) : null}

                {view.error ? (
                    <div class="notice notice-error">
                        <pre>{view.error}</pre>
                    </div>
                ) : null}
                {view.notice ? <div class="notice">{view.notice}</div> : null}
            </body>
        </html>
    )
}

function Header({ view }: { view: ViewModel }): JSX.Element {
    return (
        <div class="top">
            <div class="app-line">{view.appLabel}</div>
            <div class="status-line">
                <span class={view.statusClassName}>{view.statusLabel}</span>
                {view.elapsed ? (
                    <span class="elapsed">{view.elapsed}</span>
                ) : null}
                <span class={`chip chip-${view.sandboxTone}`}>
                    {view.sandboxLabel}
                </span>
            </div>
            <div class="meta-stack">
                <div class="meta-row">
                    <span class="meta-label">Mode</span>
                    <span class="meta-value meta-value-mode">
                        {view.modeLabel}
                    </span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">File</span>
                    <span class="meta-value">{view.fileLabel}</span>
                </div>
                {view.mode === 'method' || view.mode === 'function' ? (
                    <div class="meta-row">
                        <span class="meta-label">Target</span>
                        <span class="meta-value">{view.targetLabel}</span>
                    </div>
                ) : null}
            </div>
        </div>
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
    const { highlightCodeLines } = await loadResultViewHighlighterModule()
    return highlightCodeLines(value, language)
}

function styles(): string {
    return `
        :root {
            color-scheme: light dark;
            --bg: var(--vscode-editor-background, #111827);
            --fg: var(--vscode-editor-foreground, #e5e7eb);
            --muted: var(--vscode-descriptionForeground, #94a3b8);
            --border: var(--vscode-panel-border, #334155);
            --ok: #2f9e44;
            --error: #e03131;
            --info: #4dabf7;
            --notice: #f08c00;
            --run: #f08c00;
            --timeout: #c77dff;
            --code-bg: var(--vscode-textCodeBlock-background, #1f2937);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 24px;
            background: var(--bg);
            color: var(--fg);
            font: 14px/1.5 var(--vscode-font-family, ui-sans-serif, system-ui, sans-serif);
        }
        h2 {
            margin: 20px 0 10px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--muted);
        }
        .top { margin-bottom: 18px; }
        .app-line {
            color: var(--muted);
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .status-line {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 10px;
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
            border-color: color-mix(in srgb, var(--border) 55%, transparent 45%);
            background: transparent;
            opacity: 0.72;
        }
        .chip-alert {
            color: #ffd8a8;
            border-color: color-mix(in srgb, var(--notice) 55%, var(--border) 45%);
            background: color-mix(in srgb, var(--notice) 18%, var(--code-bg) 82%);
            opacity: 1;
        }
        .status-success { color: var(--ok); font-weight: 400; }
        .status-error { color: var(--error); font-weight: 400; }
        .status-running { color: var(--run); font-weight: 400; }
        .status-timeout { color: var(--timeout); font-weight: 400; }
        .status-success,
        .status-error,
        .status-running,
        .status-timeout {
            font-size: 15px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .meta-stack {
            display: grid;
            gap: 6px;
            margin-top: 12px;
        }
        .meta-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: baseline;
        }
        .meta-label {
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            min-width: 88px;
        }
        .meta-value {
            font-size: 13px;
            word-break: break-word;
        }
        .meta-value-mode {
            color: var(--info);
            font-weight: 700;
        }
        .notice {
            margin-top: 18px;
            color: var(--notice);
            font-size: 12px;
            border: 1px solid color-mix(in srgb, var(--notice) 40%, var(--border) 60%);
            border-radius: 10px;
            padding: 12px 14px;
            background: color-mix(in srgb, var(--code-bg) 78%, transparent 22%);
            white-space: pre-wrap;
            word-break: break-word;
        }
        .notice pre {
            margin: 0;
            padding: 0;
            background: transparent;
            color: inherit;
            font: 13px/1.45 var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, monospace);
        }
        .notice-error {
            color: var(--error);
            border-color: color-mix(in srgb, var(--error) 45%, var(--border) 55%);
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
            font: 13px/1.45 var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, monospace);
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
            font: 13px/1.45 var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, monospace);
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

export function detectLanguage(
    mode: string,
    value: string,
    isSource: boolean,
): HighlightLanguage {
    if (isSource || mode === 'method') {
        return 'php'
    }

    const trimmed = value.trim()
    if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
        return 'json'
    }

    if (looksLikeDumpOutput(trimmed)) {
        return 'php'
    }

    if (looksLikePhpLiteralOutput(trimmed)) {
        return 'php'
    }

    return 'text'
}

function looksLikeDumpOutput(value: string): boolean {
    return (
        /(?:^|\n)[A-Z_a-z\\][\w\\]*\s*\{#\d+/u.test(value) ||
        /(?:^|\n)\s*[+#?]?[A-Za-z_][\w-]*:\s+[A-Z_a-z\\][\w\\]*\s*\{#\d+/u.test(
            value,
        ) ||
        /(?:^|\n)\s*[+#?]?[A-Za-z_][\w-]*:\s+/u.test(value)
    )
}

function looksLikePhpLiteralOutput(value: string): boolean {
    return (
        /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) ||
        /^(?:true|false|null|NULL)$/u.test(value) ||
        /^(["']).*\1$/su.test(value)
    )
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}
