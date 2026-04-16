import {
    buildSandboxPrelude,
    quoteBase64,
    renderResultPhp,
} from './payload-common'
import type { PayloadBuildOptions } from './payload-types'

export function buildEvalPayload(options: PayloadBuildOptions): string {
    if (!options.selectionOrFileCode) {
        throw new Error('Missing PHP payload.')
    }

    const userCode = options.smartCapture
        ? prepareSmartCaptureCode(options.selectionOrFileCode)
        : options.selectionOrFileCode.trim()

    return [
        ...buildSandboxPrelude(options.sandboxEnabled, options.fakeStorage),
        `$__toTinkerUserCode = base64_decode(${quoteBase64(userCode)});`,
        '$__toTinkerResult = null;',
        '$__toTinkerEvalResult = null;',
        '$__toTinkerException = null;',
        "$__toTinkerBufferedOutput = '';",
        '$__toTinkerElapsedStart = microtime(true);',
        'try {',
        '    ob_start();',
        '    $__toTinkerEvalResult = eval($__toTinkerUserCode);',
        '    if (!is_null($__toTinkerEvalResult)) {',
        '        $__toTinkerResult = $__toTinkerEvalResult;',
        '    }',
        '    $__toTinkerBufferedOutput = ob_get_clean();',
        '} catch (Throwable $__toTinkerCaught) {',
        '    $__toTinkerBufferedOutput = ob_get_clean();',
        '    $__toTinkerException = $__toTinkerCaught;',
        '}',
        '$__toTinkerElapsedMs = (int) round((microtime(true) - $__toTinkerElapsedStart) * 1000);',
        renderResultPhp(true),
        '',
    ].join('\n')
}

function prepareSmartCaptureCode(source: string): string {
    const trimmed = source.trim()
    if (!trimmed) {
        throw new Error(
            'Selection is not a complete PHP statement or standalone expression. Select a full statement, or a complete expression like $user->email.',
        )
    }

    const { statements, trailing } = splitTopLevelStatements(trimmed)
    const normalizedTrailing = isCommentOnlyFragment(trailing) ? '' : trailing

    if (statements.length === 0) {
        return normalizeSingleStatementOrExpression(trimmed)
    }

    if (!normalizedTrailing) {
        const normalizedStatements = [...statements]
        const lastStatement = normalizedStatements.at(-1)

        if (lastStatement && isCapturableStatement(lastStatement)) {
            normalizedStatements[normalizedStatements.length - 1] =
                renderCapturedStatement(lastStatement)
        }

        return normalizedStatements.join('\n')
    }

    if (isCapturableStatement(normalizedTrailing)) {
        return [
            ...statements,
            renderCapturedStatement(normalizedTrailing),
        ].join('\n')
    }

    if (isObviouslyUnsupportedFragment(normalizedTrailing)) {
        throw new Error(
            'Selection is not a complete PHP statement or standalone expression. Select a full statement, or a complete expression like $user->email.',
        )
    }

    return [...statements, ensureTrailingSemicolon(normalizedTrailing)].join(
        '\n',
    )
}

function normalizeSingleStatementOrExpression(source: string): string {
    if (isCapturableStatement(source)) {
        return renderCapturedStatement(source)
    }

    if (isObviouslyUnsupportedFragment(source)) {
        throw new Error(
            'Selection is not a complete PHP statement or standalone expression. Select a full statement, or a complete expression like $user->email.',
        )
    }

    return ensureTrailingSemicolon(source)
}

function splitTopLevelStatements(source: string): {
    statements: string[]
    trailing: string
} {
    const statements: string[] = []
    let current = ''
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false
    let inLineComment = false
    let inBlockComment = false

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        const next = source[index + 1]
        const previous = source[index - 1]

        current += character

        if (inLineComment) {
            if (character === '\n') {
                inLineComment = false
            }
            continue
        }

        if (inBlockComment) {
            if (previous === '*' && character === '/') {
                inBlockComment = false
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
        } else if (character === ')') {
            parenDepth = Math.max(0, parenDepth - 1)
        } else if (character === '[') {
            bracketDepth += 1
        } else if (character === ']') {
            bracketDepth = Math.max(0, bracketDepth - 1)
        } else if (character === '{') {
            braceDepth += 1
        } else if (character === '}') {
            braceDepth = Math.max(0, braceDepth - 1)
            if (
                braceDepth === 0 &&
                parenDepth === 0 &&
                bracketDepth === 0 &&
                isTopLevelDeclarationBlock(current)
            ) {
                const statement = current.trim()
                if (statement) {
                    statements.push(statement)
                }
                current = ''
                continue
            }
        }

        if (
            character === ';' &&
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0
        ) {
            const statement = current.trim()
            if (statement) {
                statements.push(statement)
            }
            current = ''
        }
    }

    return {
        statements,
        trailing: current.trim(),
    }
}

function isTopLevelDeclarationBlock(source: string): boolean {
    const trimmed = stripInsignificant(source)
    return /^(function|class|trait|interface|enum)\b/.test(trimmed)
}

function isStandaloneExpression(source: string): boolean {
    const trimmed = stripTrailingSemicolon(stripInsignificant(source))
    if (!trimmed || isObviouslyUnsupportedFragment(trimmed)) {
        return false
    }

    if (
        /^(if|foreach|for|while|switch|try|catch|finally|function|fn|class|trait|interface|enum|namespace|use|return|echo|print|throw|break|continue|unset|global|static|public|protected|private|final|abstract|readonly|declare|do)\b/.test(
            trimmed,
        )
    ) {
        return false
    }

    return true
}

function isCapturableStatement(source: string): boolean {
    const trimmed = stripInsignificant(source)
    if (!trimmed) {
        return false
    }

    return (
        isStandaloneExpression(trimmed) ||
        hasTopLevelAssignment(stripTrailingSemicolon(trimmed)) ||
        hasTopLevelIncrementOrDecrement(stripTrailingSemicolon(trimmed))
    )
}

function isObviouslyUnsupportedFragment(source: string): boolean {
    const trimmed = stripTrailingSemicolon(stripInsignificant(source))
    if (!trimmed) {
        return true
    }

    if (!hasBalancedStructure(trimmed)) {
        return true
    }

    if (hasTopLevelDoubleArrow(trimmed)) {
        return true
    }

    return /(?:=>|,|::|->|=|:|\{)$/u.test(trimmed)
}

function hasBalancedStructure(source: string): boolean {
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        const previous = source[index - 1]

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
        } else if (character === ')') {
            parenDepth -= 1
        } else if (character === '[') {
            bracketDepth += 1
        } else if (character === ']') {
            bracketDepth -= 1
        } else if (character === '{') {
            braceDepth += 1
        } else if (character === '}') {
            braceDepth -= 1
        }

        if (parenDepth < 0 || bracketDepth < 0 || braceDepth < 0) {
            return false
        }
    }

    return (
        !inSingleQuote &&
        !inDoubleQuote &&
        parenDepth === 0 &&
        bracketDepth === 0 &&
        braceDepth === 0
    )
}

function hasTopLevelAssignment(source: string): boolean {
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        const previous = source[index - 1]
        const next = source[index + 1]

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
            continue
        }

        if (
            character === '=' &&
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0 &&
            next !== '>' &&
            previous !== '=' &&
            previous !== '!' &&
            previous !== '<' &&
            previous !== '>' &&
            previous !== '?'
        ) {
            return true
        }
    }

    return false
}

function hasTopLevelDoubleArrow(source: string): boolean {
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        const previous = source[index - 1]
        const next = source[index + 1]

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
            continue
        }

        if (
            character === '=' &&
            previous === '>' &&
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0
        ) {
            return true
        }

        if (
            character === '=' &&
            next === '>' &&
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0
        ) {
            return true
        }
    }

    return false
}

function hasTopLevelIncrementOrDecrement(source: string): boolean {
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let index = 0; index < source.length - 1; index += 1) {
        const character = source[index]
        const next = source[index + 1]
        const previous = source[index - 1]

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
            continue
        }

        if (
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0 &&
            ((character === '+' && next === '+') ||
                (character === '-' && next === '-'))
        ) {
            return true
        }
    }

    return false
}

function renderCapturedStatement(source: string): string {
    const trimmed = stripInsignificant(source)
    return `$__toTinkerResult = (${stripTrailingSemicolon(trimmed)});`
}

function stripInsignificant(source: string): string {
    let trimmed = stripTrailingInsignificant(source)

    while (trimmed.length > 0) {
        const nextLineComment = trimmed.match(/^\s*\/\/[^\n]*(?:\n|$)/)
        if (nextLineComment) {
            trimmed = trimmed.slice(nextLineComment[0].length)
            continue
        }

        const nextBlockComment = trimmed.match(/^\s*\/\*[\s\S]*?\*\//)
        if (nextBlockComment) {
            trimmed = trimmed.slice(nextBlockComment[0].length)
            continue
        }

        break
    }

    return trimmed.trim()
}

function stripTrailingInsignificant(source: string): string {
    let trimmed = source

    while (trimmed.length > 0) {
        const withoutWhitespace = trimmed.replace(/\s+$/u, '')
        if (withoutWhitespace !== trimmed) {
            trimmed = withoutWhitespace
            continue
        }

        const withoutLineComment = trimmed.replace(/\s*\/\/[^\n]*$/u, '')
        if (withoutLineComment !== trimmed) {
            trimmed = withoutLineComment
            continue
        }

        const withoutBlockComment = trimmed.replace(/\s*\/\*[\s\S]*?\*\/$/u, '')
        if (withoutBlockComment !== trimmed) {
            trimmed = withoutBlockComment
            continue
        }

        break
    }

    return trimmed.trim()
}

function isCommentOnlyFragment(source: string): boolean {
    return stripInsignificant(source) === ''
}

function ensureTrailingSemicolon(source: string): string {
    return `${stripTrailingSemicolon(source)};`
}

function stripTrailingSemicolon(source: string): string {
    return source.trim().replace(/;+$/u, '').trim()
}
