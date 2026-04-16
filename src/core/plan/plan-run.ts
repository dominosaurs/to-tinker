import type { RunMode } from '../../commands'
import {
    type FunctionInfo,
    findFunctionAtOffset,
    findFunctionMatchingSelectionInText,
    findFunctionsInText,
    findMethodAtOffset,
    findMethodMatchingSelectionInText,
    findMethodsInText,
    type MethodInfo,
    parseSelectedFunctionDeclarationInText,
} from '../discovery/callable-discovery'
import {
    INCOMPLETE_SNIPPET_ERROR,
    prepareEvalSource,
} from '../prepare/prepare-eval-source'
import {
    extractFileFromText,
    extractPrefixToLineFromText,
    extractPrefixToOffsetFromText,
    extractSelectionFromText,
    lineEndOffset,
    lineNumberAtOffset,
} from '../slice/source-slice'
import type { PlanningError } from '../types/planning-error'
import type {
    EvalRunPlan,
    FunctionRunPlan,
    MethodRunPlan,
    RunPlan,
} from '../types/run-plan'

export interface PlanRunInput {
    documentPath: string
    documentText: string
    languageId: string
    requestedMode: RunMode
    selectionActiveOffset: number
    selectionEndLine: number
    selectionEndOffset: number
    selectionsCount: number
    selectionStartLine: number
    selectionStartOffset: number
    targetOffset?: number
}

export type PlanRunResult =
    | { ok: true; plan: RunPlan }
    | { error: PlanningError; ok: false }

class PlanningFailure extends Error {
    constructor(readonly planningError: PlanningError) {
        super(planningError.message)
        this.name = 'PlanningFailure'
    }
}

export function planRun(input: PlanRunInput): PlanRunResult {
    try {
        switch (input.requestedMode) {
            case 'selection':
                return planSelectionRun(input)
            case 'file':
                return { ok: true, plan: planFileRun(input) }
            case 'line':
                return { ok: true, plan: planLineRun(input) }
            case 'method':
                return { ok: true, plan: planMethodRun(input) }
            case 'function':
                return { ok: true, plan: planFunctionRun(input) }
            default:
                return {
                    error: {
                        kind: 'unsupported-mode',
                        message: `Unsupported run mode: ${String(input.requestedMode)}`,
                    },
                    ok: false,
                }
        }
    } catch (error) {
        if (error instanceof PlanningFailure) {
            return {
                error: error.planningError,
                ok: false,
            }
        }

        return {
            error: mapUnexpectedPlanningError(error),
            ok: false,
        }
    }
}

function planSelectionRun(input: PlanRunInput): PlanRunResult {
    const {
        documentText,
        selectionEndOffset,
        selectionStartOffset,
        selectionsCount,
    } = input
    if (selectionsCount !== 1) {
        return {
            error: {
                kind: 'multiple-selections',
                message: 'Multiple selections are not supported.',
            },
            ok: false,
        }
    }

    const method = findMethodMatchingSelectionInText(
        documentText,
        selectionStartOffset,
        selectionEndOffset,
    )
    if (method) {
        return { ok: true, plan: createMethodPlan(input, method) }
    }

    const matchedTopLevelFunction = findFunctionMatchingSelectionInText(
        documentText,
        selectionStartOffset,
        selectionEndOffset,
    )
    const matchedSelectedDeclaration = parseSelectedFunctionDeclarationInText(
        documentText,
        selectionStartOffset,
        selectionEndOffset,
    )
    const callableFunction =
        matchedTopLevelFunction ?? matchedSelectedDeclaration
    if (callableFunction) {
        return {
            ok: true,
            plan: createFunctionPlan(
                input,
                callableFunction,
                matchedTopLevelFunction
                    ? undefined
                    : extractSelectionFromText(
                          documentText,
                          selectionStartOffset,
                          selectionEndOffset,
                      ),
            ),
        }
    }

    const enclosingCallable =
        findEnclosingMethod(documentText, selectionEndOffset) ??
        findEnclosingFunction(documentText, selectionEndOffset)
    if (enclosingCallable) {
        return {
            ok: true,
            plan: {
                mode: 'selection',
                smartCapture: true,
                sourceCode: extractSelectionFromText(
                    documentText,
                    selectionStartOffset,
                    selectionEndOffset,
                ),
                sourceLineEnd: input.selectionEndLine + 1,
                sourceLineStart: input.selectionStartLine + 1,
                strategy: 'eval',
            },
        }
    }

    const prefixSource = extractPrefixToOffsetFromText(
        documentText,
        selectionEndOffset,
    )
    assertCompleteEvalBoundary(prefixSource)

    return {
        ok: true,
        plan: {
            mode: 'selection',
            smartCapture: true,
            sourceCode: prefixSource,
            sourceLineEnd: input.selectionEndLine + 1,
            sourceLineStart: 1,
            strategy: 'eval',
        },
    }
}

function planFileRun(input: PlanRunInput): EvalRunPlan {
    return {
        mode: 'file',
        smartCapture: true,
        sourceCode: extractFileFromText(input.documentText),
        sourceLineEnd:
            lineNumberAtOffset(input.documentText, input.documentText.length) +
            1,
        sourceLineStart: 1,
        strategy: 'eval',
    }
}

function planLineRun(input: PlanRunInput): EvalRunPlan {
    const { documentText, selectionActiveOffset } = input
    const lineNumber = lineNumberAtOffset(documentText, selectionActiveOffset)
    const enclosingCallable =
        findEnclosingMethod(documentText, selectionActiveOffset) ??
        findEnclosingFunction(documentText, selectionActiveOffset)

    if (enclosingCallable) {
        return {
            mode: 'line',
            smartCapture: true,
            sourceCode: extractSelectionFromText(
                documentText,
                lineStartOffset(documentText, lineNumber),
                lineEndOffset(documentText, lineNumber),
            ),
            sourceLineEnd: lineNumber + 1,
            sourceLineStart: lineNumber + 1,
            strategy: 'eval',
        }
    }

    return {
        mode: 'line',
        smartCapture: true,
        sourceCode: extractPrefixToLineFromText(documentText, lineNumber),
        sourceLineEnd: lineNumber + 1,
        sourceLineStart: 1,
        strategy: 'eval',
    }
}

function planMethodRun(input: PlanRunInput): MethodRunPlan {
    const offset = input.targetOffset ?? input.selectionActiveOffset
    try {
        const method = findMethodAtOffset(input.documentText, offset)
        return createMethodPlan(input, method)
    } catch {
        throw new PlanningFailure({
            kind: 'no-callable-at-position',
            message: 'Cursor is not inside a supported concrete class method.',
        })
    }
}

function planFunctionRun(input: PlanRunInput): FunctionRunPlan {
    const offset = input.targetOffset ?? input.selectionActiveOffset
    try {
        const callableFunction = findFunctionAtOffset(
            input.documentText,
            offset,
        )
        return createFunctionPlan(input, callableFunction)
    } catch {
        throw new PlanningFailure({
            kind: 'no-callable-at-position',
            message: 'Unable to resolve function at this position.',
        })
    }
}

function createMethodPlan(
    input: PlanRunInput,
    method: MethodInfo,
): MethodRunPlan {
    return {
        method,
        mode: 'method',
        sourceCode: input.documentText.slice(method.start, method.end + 1),
        sourceLineEnd: lineNumberAtOffset(input.documentText, method.end) + 1,
        sourceLineStart:
            lineNumberAtOffset(input.documentText, method.start) + 1,
        strategy: 'method',
    }
}

function createFunctionPlan(
    input: PlanRunInput,
    callableFunction: FunctionInfo,
    functionDeclarationSource?: string,
): FunctionRunPlan {
    return {
        callableFunction,
        functionDeclarationSource,
        mode: 'function',
        sourceCode: input.documentText.slice(
            callableFunction.start,
            callableFunction.end + 1,
        ),
        sourceLineEnd:
            lineNumberAtOffset(input.documentText, callableFunction.end) + 1,
        sourceLineStart:
            lineNumberAtOffset(input.documentText, callableFunction.start) + 1,
        strategy: 'function',
    }
}

function mapUnexpectedPlanningError(error: unknown): PlanningError {
    if (error instanceof Error && error.message === INCOMPLETE_SNIPPET_ERROR) {
        return {
            kind: 'incomplete-boundary',
            message: error.message,
        }
    }

    return {
        kind: 'unsupported-target',
        message: error instanceof Error ? error.message : String(error),
    }
}

function assertCompleteEvalBoundary(source: string): void {
    try {
        prepareEvalSource(source, true)
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === INCOMPLETE_SNIPPET_ERROR
        ) {
            throw new PlanningFailure({
                kind: 'incomplete-boundary',
                message: error.message,
            })
        }

        throw error
    }
}

function findEnclosingMethod(
    text: string,
    offset: number,
): MethodInfo | undefined {
    return findMethodsInText(text)
        .filter(method => offset >= method.start && offset <= method.end)
        .sort((left, right) => left.start - right.start)
        .at(-1)
}

function findEnclosingFunction(
    text: string,
    offset: number,
): FunctionInfo | undefined {
    return findFunctionsInText(text)
        .filter(callable => offset >= callable.start && offset <= callable.end)
        .sort((left, right) => left.start - right.start)
        .at(-1)
}

function lineStartOffset(text: string, lineNumber: number): number {
    let currentLine = 0

    for (let index = 0; index < text.length; index += 1) {
        if (currentLine === lineNumber) {
            return index
        }

        if (text[index] === '\n') {
            currentLine += 1
        }
    }

    return currentLine === lineNumber ? text.length : 0
}
