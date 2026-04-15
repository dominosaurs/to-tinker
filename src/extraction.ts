import type * as vscode from 'vscode'

export interface ClassInfo {
    name: string
    start: number
    end: number
}

export interface MethodParameter {
    name: string
    signatureHint: string
    resolvableByContainer: boolean
    hasDefault: boolean
    defaultExpression?: string
}

export interface MethodInfo {
    namespaceName?: string
    className: string
    fullyQualifiedClassName: string
    methodName: string
    visibility: 'public' | 'protected' | 'private'
    isStatic: boolean
    start: number
    end: number
    parameters: MethodParameter[]
}

export function extractSelection(
    document: vscode.TextDocument,
    selection: vscode.Selection,
): string {
    if (selection.isEmpty) {
        throw new Error('Selection is empty. Select PHP code first.')
    }

    const text = document.getText(selection).trim()
    if (!text) {
        throw new Error('Selection is empty. Select PHP code first.')
    }

    return stripPhpTags(text)
}

export function extractFile(document: vscode.TextDocument): string {
    return stripPhpTags(document.getText())
}

export function findMethodAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
): MethodInfo {
    const cursorOffset = document.offsetAt(position)
    const methods = findMethods(document)
    const target = methods
        .filter(
            method =>
                cursorOffset >= method.start && cursorOffset <= method.end,
        )
        .sort((left, right) => left.start - right.start)
        .at(-1)

    if (!target) {
        throw new Error(
            'Cursor is not inside a supported concrete class method.',
        )
    }

    return target
}

export function findMethods(document: vscode.TextDocument): MethodInfo[] {
    const text = document.getText()
    const namespaceName = parseNamespace(text)
    const classes = parseClasses(text)
    return parseMethods(text, classes, namespaceName)
}

function parseNamespace(text: string): string | undefined {
    const match = text.match(/\bnamespace\s+([^;{]+)\s*[;{]/)
    return match?.[1]?.trim()
}

function parseClasses(text: string): ClassInfo[] {
    const classes: ClassInfo[] = []
    const classRegex =
        /\b(?:(?:abstract|final|readonly)\s+)*class\s+([A-Za-z_][A-Za-z0-9_]*)[^{]*\{/g

    for (const match of text.matchAll(classRegex)) {
        const name = match[1]
        const start = match.index
        const braceIndex = start + match[0].lastIndexOf('{')
        const end = findBlockEnd(text, braceIndex)
        if (
            name &&
            start !== undefined &&
            end !== undefined &&
            !match[0].includes('abstract')
        ) {
            classes.push({ end, name, start })
        }
    }

    return classes
}

function parseMethods(
    text: string,
    classes: ClassInfo[],
    namespaceName?: string,
): MethodInfo[] {
    const methods: MethodInfo[] = []
    const methodRegex =
        /(?:#\[[\s\S]*?\]\s*)*\b(?:final\s+)?(public|protected|private)?\s*(static\s+)?function\s*&?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*(?::\s*[\w\\|&?()\s]+)?\s*\{/g

    for (const match of text.matchAll(methodRegex)) {
        const start = match.index
        if (start === undefined) {
            continue
        }

        const owningClass = classes.find(
            candidate => start >= candidate.start && start <= candidate.end,
        )
        if (!owningClass) {
            continue
        }

        const name = match[3]
        const parameterSource = match[4] ?? ''
        const braceIndex = start + match[0].lastIndexOf('{')
        const end = findBlockEnd(text, braceIndex)

        if (!name || end === undefined) {
            continue
        }

        methods.push({
            className: owningClass.name,
            end,
            fullyQualifiedClassName: namespaceName
                ? `${namespaceName}\\${owningClass.name}`
                : owningClass.name,
            isStatic: Boolean(match[2]?.trim()),
            methodName: name,
            namespaceName,
            parameters: parseParameters(parameterSource),
            start,
            visibility: normalizeVisibility(match[1]),
        })
    }

    return methods
}

function normalizeVisibility(
    value: string | undefined,
): 'public' | 'protected' | 'private' {
    if (value === 'protected' || value === 'private') {
        return value
    }

    return 'public'
}

function parseParameters(source: string): MethodParameter[] {
    const parameters = splitParameterList(source)
        .map(item => item.trim())
        .filter(Boolean)

    return parameters.map(parameter => {
        const normalizedParameter = stripParameterDecorators(parameter)
        const variableMatch = normalizedParameter.match(
            /\$([A-Za-z_][A-Za-z0-9_]*)/,
        )
        const defaultMatch = parameter.match(/=\s*(.+)$/)
        const typePart = variableMatch
            ? normalizedParameter.slice(0, variableMatch.index).trim()
            : ''
        const signatureHint = normalizeSignatureHint(typePart)
        const hasDefault = Boolean(defaultMatch)
        const defaultExpression = defaultMatch?.[1]?.trim()
        const resolvableByContainer =
            Boolean(signatureHint) &&
            !/[|?]/.test(signatureHint) &&
            !isBuiltinType(signatureHint) &&
            !normalizedParameter.includes('&')

        if (!variableMatch) {
            throw new Error(`Unable to parse method parameter: ${parameter}`)
        }

        return {
            defaultExpression,
            hasDefault,
            name: variableMatch[1] ?? '',
            resolvableByContainer,
            signatureHint,
        }
    })
}

function splitParameterList(source: string): string[] {
    const items: string[] = []
    let current = ''
    let depth = 0
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        const previous = source[index - 1]

        if (character === "'" && !inDoubleQuote && previous !== '\\') {
            inSingleQuote = !inSingleQuote
        } else if (character === '"' && !inSingleQuote && previous !== '\\') {
            inDoubleQuote = !inDoubleQuote
        }

        if (inSingleQuote || inDoubleQuote) {
            current += character
            continue
        }

        if (character === '(' || character === '[' || character === '{') {
            depth += 1
        } else if (
            character === ')' ||
            character === ']' ||
            character === '}'
        ) {
            depth = Math.max(0, depth - 1)
        }

        if (character === ',' && depth === 0) {
            items.push(current)
            current = ''
            continue
        }

        current += character
    }

    if (current.trim()) {
        items.push(current)
    }

    return items
}

function isBuiltinType(type: string): boolean {
    return [
        'int',
        'float',
        'string',
        'bool',
        'array',
        'callable',
        'iterable',
        'object',
        'mixed',
        'null',
        'false',
        'true',
        'self',
        'parent',
    ].includes(type.toLowerCase())
}

function stripParameterDecorators(parameter: string): string {
    return parameter
        .replace(/^(?:#\[[\s\S]*?\]\s*)+/u, '')
        .replace(/^(?:public|protected|private|readonly)\s+/u, '')
        .trim()
}

function normalizeSignatureHint(value: string): string {
    return value
        .replace(/^(?:readonly)\s+/u, '')
        .replace(/\.\.\./g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function findBlockEnd(
    text: string,
    openBraceIndex: number,
): number | undefined {
    let depth = 0
    let inSingleQuote = false
    let inDoubleQuote = false
    let inLineComment = false
    let inBlockComment = false

    for (let index = openBraceIndex; index < text.length; index += 1) {
        const character = text[index]
        const next = text[index + 1]
        const previous = text[index - 1]

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

        if (character === '{') {
            depth += 1
        } else if (character === '}') {
            depth -= 1
            if (depth === 0) {
                return index
            }
        }
    }

    return undefined
}

function stripPhpTags(text: string): string {
    return text
        .replace(/^<\?php\s*/u, '')
        .replace(/\?>\s*$/u, '')
        .trim()
}
