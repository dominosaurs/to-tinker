// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI stripping.
const ANSI_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

export function stripAnsi(value: string): string {
    return value.replaceAll(ANSI_PATTERN, '')
}
