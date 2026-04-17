import * as fs from 'node:fs'
import * as vscode from 'vscode'
import { getConfig } from './config'
import type { FunctionInfo, MethodInfo, MethodParameter } from './extraction'

export function resolvePhpExecutable(): string {
    const phpPath = getConfig().phpPath
    if (!phpPath) {
        return 'php'
    }

    if (!fs.existsSync(phpPath)) {
        throw new Error(
            `Configured PHP path does not exist: ${phpPath}. Update toTinker.phpPath or clear it to use php from PATH.`,
        )
    }

    try {
        fs.accessSync(phpPath, fs.constants.X_OK)
    } catch {
        throw new Error(
            `Configured PHP path is not executable: ${phpPath}. Update toTinker.phpPath to a PHP binary the extension host can execute.`,
        )
    }

    return phpPath
}

export async function promptForParameter(
    callable: MethodInfo | FunctionInfo,
    parameter: MethodParameter,
): Promise<string> {
    const callableSignature = formatCallableSignature(callable)
    const callableTitle = formatCallableTitle(callable)
    const value = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        placeHolder:
            parameter.signatureHint || parameter.defaultExpression
                ? `${parameter.signatureHint || 'mixed'}${parameter.defaultExpression ? `, default ${parameter.defaultExpression}` : ''}`
                : "Examples: 123, 'text', User::first(), ['a' => 1]",
        prompt: `Enter PHP expression for $${parameter.name} in ${callableSignature}`,
        title: `To Tinker: ${callableTitle}`,
    })

    if (!value?.trim()) {
        throw new Error(
            `Missing PHP expression for parameter $${parameter.name} in ${callableTitle}.`,
        )
    }

    return normalizePromptedValue(value.trim(), parameter.signatureHint)
}

function formatCallableSignature(callable: MethodInfo | FunctionInfo): string {
    const parameters = callable.parameters
        .map(parameter => {
            const signature = parameter.signatureHint
                ? `${parameter.signatureHint} `
                : ''
            const fallback = parameter.defaultExpression
                ? ` = ${parameter.defaultExpression}`
                : ''
            return `${signature}$${parameter.name}${fallback}`
        })
        .join(', ')

    if ('methodName' in callable) {
        return `${callable.className}::${callable.methodName}(${parameters})`
    }

    return `${callable.functionName}(${parameters})`
}

function formatCallableTitle(callable: MethodInfo | FunctionInfo): string {
    if ('methodName' in callable) {
        return `${callable.className}::${callable.methodName}`
    }

    return callable.functionName
}

function normalizePromptedValue(value: string, signatureHint: string): string {
    const normalizedType = signatureHint.toLowerCase()

    if (looksLikePhpExpression(value)) {
        return value
    }

    switch (normalizedType) {
        case 'string':
            return `'${escapePhpString(value)}'`
        case 'int':
        case 'integer':
            return /^-?\d+$/.test(value) ? value : `'${escapePhpString(value)}'`
        case 'float':
        case 'double':
            return /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)
                ? value
                : `'${escapePhpString(value)}'`
        case 'bool':
        case 'boolean':
            return normalizeBooleanValue(value)
        default:
            return value
    }
}

function looksLikePhpExpression(value: string): boolean {
    return (
        /^(?:'.*'|".*"|-?(?:\d+(?:\.\d+)?|\.\d+)|true|false|null|NULL|\[.*\]|\$[A-Za-z_]|new\s+[A-Za-z_\\]|[A-Za-z_\\][\w\\]*::|[A-Za-z_\\][\w\\]*\s*\(|fn\s*\(|function\b)/su.test(
            value,
        ) || /(?:->|::|\(|\)|\[|\]|\{|\}|=>)/.test(value)
    )
}

function normalizeBooleanValue(value: string): string {
    const normalized = value.trim().toLowerCase()

    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
        return 'true'
    }

    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
        return 'false'
    }

    return `'${escapePhpString(value)}'`
}

function escapePhpString(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}
