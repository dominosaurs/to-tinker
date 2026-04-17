export function shouldShowRunFileForText(text: string): boolean {
    const units = extractTopLevelUnits(text)
    const significantUnits = units.filter(unit => unit.kind !== 'comment')

    if (significantUnits.length === 0) {
        return true
    }

    return significantUnits.some(
        unit => unit.kind === 'function' || unit.kind === 'statement',
    )
}

type TopLevelUnitKind =
    | 'classlike'
    | 'comment'
    | 'declare'
    | 'function'
    | 'namespace'
    | 'statement'
    | 'use'

interface TopLevelUnit {
    kind: TopLevelUnitKind
    text: string
}

function extractTopLevelUnits(text: string): TopLevelUnit[] {
    const units: TopLevelUnit[] = []
    let current = ''
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false
    let inLineComment = false
    let inBlockComment = false

    const pushCurrent = (): void => {
        const trimmed = current.trim()
        if (!trimmed) {
            current = ''
            return
        }

        units.push({
            kind: classifyTopLevelUnit(trimmed),
            text: trimmed,
        })
        current = ''
    }

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index]
        const next = text[index + 1]
        const previous = text[index - 1]

        current += character

        if (inLineComment) {
            if (character === '\n') {
                inLineComment = false
                pushCurrent()
            }
            continue
        }

        if (inBlockComment) {
            if (previous === '*' && character === '/') {
                inBlockComment = false
                if (
                    braceDepth === 0 &&
                    parenDepth === 0 &&
                    bracketDepth === 0
                ) {
                    pushCurrent()
                }
            }
            continue
        }

        if (!inSingleQuote && !inDoubleQuote) {
            if (character === '/' && next === '/') {
                inLineComment = true
                continue
            }

            if (character === '/' && next === '*') {
                inBlockComment = true
                continue
            }
        }

        if (character === "'" && !inDoubleQuote && previous !== '\\') {
            inSingleQuote = !inSingleQuote
            continue
        }

        if (character === '"' && !inSingleQuote && previous !== '\\') {
            inDoubleQuote = !inDoubleQuote
            continue
        }

        if (inSingleQuote || inDoubleQuote) {
            continue
        }

        if (character === '(') {
            parenDepth += 1
            continue
        }

        if (character === ')') {
            parenDepth = Math.max(0, parenDepth - 1)
            continue
        }

        if (character === '[') {
            bracketDepth += 1
            continue
        }

        if (character === ']') {
            bracketDepth = Math.max(0, bracketDepth - 1)
            continue
        }

        if (character === '{') {
            braceDepth += 1
            continue
        }

        if (character === '}') {
            braceDepth = Math.max(0, braceDepth - 1)
            if (braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
                pushCurrent()
            }
            continue
        }

        if (
            character === ';' &&
            braceDepth === 0 &&
            parenDepth === 0 &&
            bracketDepth === 0
        ) {
            pushCurrent()
        }
    }

    pushCurrent()

    return units
}

function classifyTopLevelUnit(source: string): TopLevelUnitKind {
    const normalized = source.replace(/^<\?php\s*/u, '').trim()

    if (/^(?:\/\/|\/\*|#)/u.test(normalized)) {
        return 'comment'
    }

    if (/^namespace\b/u.test(normalized)) {
        return 'namespace'
    }

    if (/^use\b/u.test(normalized)) {
        return 'use'
    }

    if (/^declare\b/u.test(normalized)) {
        return 'declare'
    }

    if (/^(?:#\[[\s\S]*?\]\s*)*function\b/u.test(normalized)) {
        return 'function'
    }

    if (
        /^(?:#\[[\s\S]*?\]\s*)*(?:(?:abstract|final|readonly)\s+)*(?:class|trait|interface|enum)\b/u.test(
            normalized,
        )
    ) {
        return 'classlike'
    }

    return 'statement'
}
