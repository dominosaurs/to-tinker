export function shouldShowRunFileForText(text: string): boolean {
    let inBlockComment = false

    for (const line of text.split(/\r?\n/u)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === '<?php') {
            continue
        }

        if (inBlockComment) {
            if (trimmed.includes('*/')) {
                inBlockComment = false
            }

            continue
        }

        if (trimmed.startsWith('/*')) {
            if (!trimmed.includes('*/')) {
                inBlockComment = true
            }

            continue
        }

        if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
            continue
        }

        if (line !== trimmed) {
            continue
        }

        if (isTopLevelStructuralLine(trimmed)) {
            continue
        }

        return true
    }

    return false
}

function isTopLevelStructuralLine(trimmed: string): boolean {
    return (
        startsWithKeyword(trimmed, 'namespace') ||
        (trimmed.startsWith('use ') && !trimmed.startsWith('use (')) ||
        startsWithKeyword(trimmed, 'declare') ||
        trimmed.startsWith('#[') ||
        startsWithKeyword(trimmed, 'class') ||
        trimmed === '{' ||
        trimmed === '}'
    )
}

function startsWithKeyword(text: string, keyword: string): boolean {
    if (!text.startsWith(keyword)) {
        return false
    }

    const next = text.charAt(keyword.length)
    return next === '' || /\s|[({;]/u.test(next)
}
