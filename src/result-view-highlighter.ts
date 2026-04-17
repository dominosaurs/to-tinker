import {
    createBundledHighlighter,
    createSingletonShorthands,
} from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import type { ThemedTokenWithVariants } from '@shikijs/types'

export type HighlightLanguage = 'json' | 'php' | 'text'

export interface HighlightToken {
    content: string
    darkColor?: string
    lightColor?: string
    bold?: boolean
    italic?: boolean
    strike?: boolean
    underline?: boolean
}

export interface HighlightLine {
    tokens: HighlightToken[]
}

const shiki = createSingletonShorthands(
    createBundledHighlighter({
        engine: createJavaScriptRegexEngine,
        langs: {
            json: async () => (await import('@shikijs/langs/json')).default,
            php: async () => (await import('@shikijs/langs/php')).default,
        },
        themes: {
            'github-dark': async () =>
                (await import('@shikijs/themes/github-dark')).default,
            'github-light': async () =>
                (await import('@shikijs/themes/github-light')).default,
        },
    }),
)

export async function highlightCodeLines(
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
                dark: 'github-dark',
                light: 'github-light',
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
