import type * as vscode from 'vscode'
import { trimWhitespaceBounds } from '../slice/source-slice'

export interface ClassInfo {
    name: string
    start: number
    bodyDepth: number
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
    nameStart: number
    visibility: 'public' | 'protected' | 'private'
    isStatic: boolean
    start: number
    end: number
    parameters: MethodParameter[]
}

export interface FunctionInfo {
    namespaceName?: string
    functionName: string
    nameStart: number
    fullyQualifiedFunctionName: string
    start: number
    end: number
    parameters: MethodParameter[]
}

export function findMethodAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
): MethodInfo {
    return findMethodAtOffset(document.getText(), document.offsetAt(position))
}

export function findMethodAtOffset(text: string, offset: number): MethodInfo {
    const target = findMethodsInText(text)
        .filter(method => offset >= method.start && offset <= method.end)
        .sort((left, right) => left.start - right.start)
        .at(-1)

    if (!target) {
        throw new Error(
            'Cursor is not inside a supported concrete class method.',
        )
    }

    return target
}

export function findFunctionAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
): FunctionInfo {
    return findFunctionAtOffset(document.getText(), document.offsetAt(position))
}

export function findFunctionAtOffset(
    text: string,
    offset: number,
): FunctionInfo {
    const target = findFunctionsInText(text)
        .filter(callable => offset >= callable.start && offset <= callable.end)
        .sort((left, right) => left.start - right.start)
        .at(-1)

    if (!target) {
        throw new Error('Unable to resolve function at this position.')
    }

    return target
}

export function findMethods(document: vscode.TextDocument): MethodInfo[] {
    return findMethodsInText(document.getText())
}

export function findMethodsInText(text: string): MethodInfo[] {
    const namespaceName = parseNamespace(text)
    const classes = parseClasses(text)
    return parseMethods(text, classes, namespaceName)
}

export function findFunctions(document: vscode.TextDocument): FunctionInfo[] {
    return findFunctionsInText(document.getText())
}

export function findFunctionsInText(text: string): FunctionInfo[] {
    const namespaceName = parseNamespace(text)
    const classes = parseClasses(text)
    return parseFunctions(text, classes, namespaceName)
}

export function findFunctionMatchingSelection(
    document: vscode.TextDocument,
    selection: vscode.Selection,
): FunctionInfo | undefined {
    return findFunctionMatchingSelectionInText(
        document.getText(),
        document.offsetAt(selection.start),
        document.offsetAt(selection.end),
    )
}

export function findFunctionMatchingSelectionInText(
    text: string,
    startOffset: number,
    endOffset: number,
): FunctionInfo | undefined {
    const [trimmedStart, trimmedEnd] = trimWhitespaceBounds(
        text,
        startOffset,
        endOffset,
    )

    return findFunctionsInText(text).find(
        callable =>
            callable.start === trimmedStart && callable.end + 1 === trimmedEnd,
    )
}

export function findMethodMatchingSelection(
    document: vscode.TextDocument,
    selection: vscode.Selection,
): MethodInfo | undefined {
    return findMethodMatchingSelectionInText(
        document.getText(),
        document.offsetAt(selection.start),
        document.offsetAt(selection.end),
    )
}

export function findMethodMatchingSelectionInText(
    text: string,
    startOffset: number,
    endOffset: number,
): MethodInfo | undefined {
    const [trimmedStart, trimmedEnd] = trimWhitespaceBounds(
        text,
        startOffset,
        endOffset,
    )

    return findMethodsInText(text).find(
        method =>
            method.start === trimmedStart && method.end + 1 === trimmedEnd,
    )
}

export function parseSelectedFunctionDeclaration(
    document: vscode.TextDocument,
    selection: vscode.Selection,
): FunctionInfo | undefined {
    return parseSelectedFunctionDeclarationInText(
        document.getText(),
        document.offsetAt(selection.start),
        document.offsetAt(selection.end),
    )
}

export function parseSelectedFunctionDeclarationInText(
    text: string,
    startOffset: number,
    endOffset: number,
): FunctionInfo | undefined {
    const [trimmedStart, trimmedEnd] = trimWhitespaceBounds(
        text,
        startOffset,
        endOffset,
    )
    const selectedText = text.slice(trimmedStart, trimmedEnd)
    const declaration = selectedText.trim()
    const namespaceName = parseNamespace(text)
    const functionRegex =
        /(?:#\[[\s\S]*?\]\s*)*\bfunction\b\s*&?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*(?::\s*[\w\\|&?()\s]+)?\s*\{/u
    const match = declaration.match(functionRegex)

    if (!match || match.index !== 0) {
        return undefined
    }

    const braceIndex = match[0].lastIndexOf('{')
    const end = findBlockEnd(declaration, braceIndex)
    const name = match[1]
    if (!name || end === undefined || end !== declaration.length - 1) {
        return undefined
    }

    return {
        end: trimmedStart + end,
        fullyQualifiedFunctionName: namespaceName
            ? `\\${namespaceName}\\${name}`
            : name,
        functionName: name,
        nameStart: trimmedStart + match[0].indexOf(name),
        namespaceName,
        parameters: parseParameters(match[2] ?? ''),
        start: trimmedStart,
    }
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
            classes.push({
                bodyDepth: braceDepthAtOffset(text, start) + 1,
                end,
                name,
                start,
            })
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
        /(?:#\[[\s\S]*?\]\s*)*\b(?:final\s+)?(public|protected|private)?\s*(static\s+)?function\b\s*&?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*(?::\s*[\w\\|&?()\s]+)?\s*\{/g

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

        if (braceDepthAtOffset(text, start) !== owningClass.bodyDepth) {
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
            nameStart: start + match[0].indexOf(name),
            namespaceName,
            parameters: parseParameters(parameterSource),
            start,
            visibility: normalizeVisibility(match[1]),
        })
    }

    return methods
}

function parseFunctions(
    text: string,
    classes: ClassInfo[],
    namespaceName?: string,
): FunctionInfo[] {
    const functions: FunctionInfo[] = []
    const functionRegex =
        /(?:#\[[\s\S]*?\]\s*)*\bfunction\b\s*&?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*(?::\s*[\w\\|&?()\s]+)?\s*\{/g

    for (const match of text.matchAll(functionRegex)) {
        const start = match.index
        if (start === undefined) {
            continue
        }

        if (
            classes.some(
                candidate => start >= candidate.start && start <= candidate.end,
            )
        ) {
            continue
        }

        if (braceDepthAtOffset(text, start) !== 0) {
            continue
        }

        const name = match[1]
        const parameterSource = match[2] ?? ''
        const braceIndex = start + match[0].lastIndexOf('{')
        const end = findBlockEnd(text, braceIndex)

        if (!name || end === undefined) {
            continue
        }

        functions.push({
            end,
            fullyQualifiedFunctionName: namespaceName
                ? `\\${namespaceName}\\${name}`
                : name,
            functionName: name,
            nameStart: start + match[0].indexOf(name),
            namespaceName,
            parameters: parseParameters(parameterSource),
            start,
        })
    }

    return functions
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

function braceDepthAtOffset(text: string, targetOffset: number): number {
    let depth = 0
    let inSingleQuote = false
    let inDoubleQuote = false
    let inLineComment = false
    let inBlockComment = false

    for (
        let index = 0;
        index < text.length && index < targetOffset;
        index += 1
    ) {
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
            depth = Math.max(0, depth - 1)
        }
    }

    return depth
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
