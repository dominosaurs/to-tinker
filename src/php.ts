import * as fs from 'node:fs'
import * as vscode from 'vscode'
import { getConfig } from './config'
import type { MethodInfo, MethodParameter } from './extraction'

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
    method: MethodInfo,
    parameter: MethodParameter,
): Promise<string> {
    const methodSignature = formatMethodSignature(method)
    const value = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        placeHolder:
            parameter.signatureHint || parameter.defaultExpression
                ? `${parameter.signatureHint || 'mixed'}${parameter.defaultExpression ? `, default ${parameter.defaultExpression}` : ''}`
                : "Examples: 123, 'text', User::first(), ['a' => 1]",
        prompt: `Enter PHP expression for $${parameter.name} in ${methodSignature}`,
        title: `To Tinker: ${method.className}::${method.methodName}`,
    })

    if (!value?.trim()) {
        throw new Error(
            `Missing PHP expression for parameter $${parameter.name} in ${method.className}::${method.methodName}.`,
        )
    }

    return value.trim()
}

function formatMethodSignature(method: MethodInfo): string {
    const parameters = method.parameters
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

    return `${method.className}::${method.methodName}(${parameters})`
}
