import { beforeEach, vi } from 'vitest'
import * as vscode from 'vscode'
import { commands } from '../vscode'

export const executeTinker = vi.fn()
export const renderExecutionReport = vi.fn()
export const prepareExecutionEnvironment = vi.fn()
export const promptForParameter = vi.fn()
export const setSandboxDefaultEnabled = vi.fn()
export const buildFunctionPayload = vi.fn(() => 'function payload')
export const buildMethodPayload = vi.fn(() => 'method payload')
export const buildTinkerPayload = vi.fn(() => 'payload')
export const findFunctionAtPosition = vi.fn()
export const findMethodAtPosition = vi.fn()

vi.mock('../../src/runner', async () => {
    const actual =
        await vi.importActual<typeof import('../../src/runner')>(
            '../../src/runner',
        )

    return {
        ...actual,
        executeTinker,
        renderExecutionReport,
    }
})

vi.mock('../../src/preflight', () => ({
    prepareExecutionEnvironment,
}))

vi.mock('../../src/config', async () => {
    const actual =
        await vi.importActual<typeof import('../../src/config')>(
            '../../src/config',
        )

    return {
        ...actual,
        setSandboxDefaultEnabled,
    }
})

vi.mock('../../src/php', () => ({
    promptForParameter,
}))

vi.mock('../../src/wrapper', () => ({
    buildFunctionPayload,
    buildMethodPayload,
    buildTinkerPayload,
}))

vi.mock('../../src/extraction', async () => {
    const actual = await vi.importActual<typeof import('../../src/extraction')>(
        '../../src/extraction',
    )

    return {
        ...actual,
        findFunctionAtPosition,
        findMethodAtPosition,
    }
})

export function useExtensionFixture(): void {
    beforeEach(() => {
        vi.clearAllMocks()
        commands.registerCommand.mockClear()
        executeTinker.mockResolvedValue({
            stderr: '',
            stdout: '__TO_TINKER_RESULT__\n42\n__TO_TINKER_DIAGNOSTICS__\nelapsed_ms=1\n',
            timedOut: false,
        })
        renderExecutionReport.mockResolvedValue(undefined)
        prepareExecutionEnvironment.mockReturnValue({
            phpExecutable: '/usr/bin/php',
            workspace: {
                artisanPath: '/workspace/artisan',
                rootPath: '/workspace',
                workspaceFolder: {
                    index: 0,
                    name: 'demo',
                    uri: vscode.Uri.file('/workspace'),
                },
            },
        })
        promptForParameter.mockResolvedValue("'from prompt'")
        findFunctionAtPosition.mockReturnValue({
            end: 60,
            fullyQualifiedFunctionName: '\\App\\Support\\build_report',
            functionName: 'build_report',
            nameStart: 0,
            namespaceName: 'App\\Support',
            parameters: [],
            start: 0,
        })
        findMethodAtPosition.mockReturnValue({
            className: 'ReportRunner',
            end: 60,
            fullyQualifiedClassName: 'App\\Services\\ReportRunner',
            isStatic: false,
            methodName: 'build',
            nameStart: 0,
            parameters: [],
            start: 0,
            visibility: 'public',
        })
        buildMethodPayload.mockReturnValue('method payload')
        buildFunctionPayload.mockReturnValue('function payload')
        buildTinkerPayload.mockReturnValue('payload')
        setSandboxDefaultEnabled.mockResolvedValue(undefined)
    })
}
