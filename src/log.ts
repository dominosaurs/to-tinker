import * as vscode from 'vscode'

export class Log {
    private readonly channel =
        vscode.window.createOutputChannel('To-Tinker Logs')

    show(): void {
        this.channel.show(true)
    }

    dispose(): void {
        this.channel.dispose()
    }

    info(message: string): void {
        this.channel.appendLine(`[${timestamp()}] ${message}`)
    }
}

function timestamp(): string {
    return new Date().toISOString()
}
