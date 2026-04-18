import * as vscode from 'vscode'

interface SandboxConfig {
    // TODO: Rename to DryRunConfig in next major version
    defaultEnabled: boolean
    fakeStorage: boolean
}

interface ExtensionConfig {
    phpPath: string | undefined
    timeoutSeconds: number
    codeLensEnabled: boolean
    // TODO: Rename to dryRun in next major version
    sandbox: SandboxConfig
}

export function getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('toTinker')

    return {
        codeLensEnabled: config.get<boolean>('codeLens.enabled', true),
        phpPath: normalizeOptionalString(config.get<string>('phpPath')),
        sandbox: {
            defaultEnabled: config.get<boolean>('sandbox.defaultEnabled', true),
            fakeStorage: config.get<boolean>('sandbox.fakeStorage', false),
        },
        timeoutSeconds: Math.max(1, config.get<number>('timeoutSeconds', 15)),
    }
}

export async function setSandboxDefaultEnabled(
    enabled: boolean,
): Promise<void> {
    const config = vscode.workspace.getConfiguration('toTinker')
    const target =
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global

    await config.update('sandbox.defaultEnabled', enabled, target)
}

function normalizeOptionalString(
    value: string | undefined,
): string | undefined {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
}
