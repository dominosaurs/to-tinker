import * as vscode from 'vscode'
import type { RunMode } from '../../commands'
import {
    type FunctionInfo,
    findFunctionAtPosition,
    findFunctionMatchingSelection,
    findFunctions,
    findMethodAtPosition,
    findMethodMatchingSelection,
    findMethods,
    type MethodInfo,
    parseSelectedFunctionDeclaration,
} from '../discovery/callable-discovery'
import {
    extractFile,
    extractPrefixToLine,
    extractPrefixToSelectionEnd,
    extractSelection,
} from '../slice/source-slice'
import type { PlanningError } from '../types/planning-error'
import type {
    EvalRunPlan,
    FunctionRunPlan,
    MethodRunPlan,
    RunPlan,
} from '../types/run-plan'

export interface PlanRunInput {
    document: vscode.TextDocument
    requestedMode: RunMode
    selection: vscode.Selection
    selectionsCount: number
    targetPosition?: vscode.Position
}

export type PlanRunResult =
    | { ok: true; plan: RunPlan }
    | { error: PlanningError; ok: false }

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
        return {
            error: {
                kind: 'unsupported-target',
                message: error instanceof Error ? error.message : String(error),
            },
            ok: false,
        }
    }
}

function planSelectionRun(input: PlanRunInput): PlanRunResult {
    const { document, selection, selectionsCount } = input
    if (selectionsCount !== 1) {
        return {
            error: {
                kind: 'multiple-selections',
                message: 'Multiple selections are not supported.',
            },
            ok: false,
        }
    }

    const method = findMethodMatchingSelection(document, selection)
    if (method) {
        return { ok: true, plan: createMethodPlan(document, method) }
    }

    const matchedTopLevelFunction = findFunctionMatchingSelection(
        document,
        selection,
    )
    const matchedSelectedDeclaration = parseSelectedFunctionDeclaration(
        document,
        selection,
    )
    const callableFunction =
        matchedTopLevelFunction ?? matchedSelectedDeclaration
    if (callableFunction) {
        return {
            ok: true,
            plan: createFunctionPlan(
                document,
                callableFunction,
                matchedTopLevelFunction
                    ? undefined
                    : extractSelection(document, selection),
            ),
        }
    }

    const enclosingCallable =
        findEnclosingMethod(document, selection.end) ??
        findEnclosingFunction(document, selection.end)
    if (enclosingCallable) {
        return {
            ok: true,
            plan: {
                mode: 'selection',
                smartCapture: true,
                sourceCode: extractSelection(document, selection),
                sourceLineEnd: selection.end.line + 1,
                sourceLineStart: selection.start.line + 1,
                strategy: 'eval',
            },
        }
    }

    return {
        ok: true,
        plan: {
            mode: 'selection',
            smartCapture: true,
            sourceCode: extractPrefixToSelectionEnd(document, selection),
            sourceLineEnd: selection.end.line + 1,
            sourceLineStart: 1,
            strategy: 'eval',
        },
    }
}

function planFileRun(input: PlanRunInput): EvalRunPlan {
    return {
        mode: 'file',
        smartCapture: true,
        sourceCode: extractFile(input.document),
        sourceLineEnd: input.document.lineCount,
        sourceLineStart: 1,
        strategy: 'eval',
    }
}

function planLineRun(input: PlanRunInput): EvalRunPlan {
    const { document, selection } = input
    const lineNumber = selection.active.line
    const enclosingCallable =
        findEnclosingMethod(document, selection.active) ??
        findEnclosingFunction(document, selection.active)

    if (enclosingCallable) {
        const lineSelection = new vscode.Selection(
            new vscode.Position(lineNumber, 0),
            document.lineAt(lineNumber).range.end,
        )

        return {
            mode: 'line',
            smartCapture: true,
            sourceCode: extractSelection(document, lineSelection),
            sourceLineEnd: lineNumber + 1,
            sourceLineStart: lineNumber + 1,
            strategy: 'eval',
        }
    }

    return {
        mode: 'line',
        smartCapture: true,
        sourceCode: extractPrefixToLine(document, selection.active),
        sourceLineEnd: lineNumber + 1,
        sourceLineStart: 1,
        strategy: 'eval',
    }
}

function planMethodRun(input: PlanRunInput): MethodRunPlan {
    const method = findMethodAtPosition(
        input.document,
        input.targetPosition ?? input.selection.active,
    )

    return createMethodPlan(input.document, method)
}

function planFunctionRun(input: PlanRunInput): FunctionRunPlan {
    const callableFunction = findFunctionAtPosition(
        input.document,
        input.targetPosition ?? input.selection.active,
    )

    return createFunctionPlan(input.document, callableFunction)
}

function createMethodPlan(
    document: vscode.TextDocument,
    method: MethodInfo,
): MethodRunPlan {
    return {
        method,
        mode: 'method',
        sourceCode: document.getText().slice(method.start, method.end + 1),
        sourceLineEnd: document.positionAt(method.end).line + 1,
        sourceLineStart: document.positionAt(method.start).line + 1,
        strategy: 'method',
    }
}

function createFunctionPlan(
    document: vscode.TextDocument,
    callableFunction: FunctionInfo,
    functionDeclarationSource?: string,
): FunctionRunPlan {
    return {
        callableFunction,
        functionDeclarationSource,
        mode: 'function',
        sourceCode: document
            .getText()
            .slice(callableFunction.start, callableFunction.end + 1),
        sourceLineEnd: document.positionAt(callableFunction.end).line + 1,
        sourceLineStart: document.positionAt(callableFunction.start).line + 1,
        strategy: 'function',
    }
}

function findEnclosingMethod(
    document: vscode.TextDocument,
    position: vscode.Position,
): MethodInfo | undefined {
    const cursorOffset = document.offsetAt(position)
    return findMethods(document)
        .filter(
            method =>
                cursorOffset >= method.start && cursorOffset <= method.end,
        )
        .sort((left, right) => left.start - right.start)
        .at(-1)
}

function findEnclosingFunction(
    document: vscode.TextDocument,
    position: vscode.Position,
): FunctionInfo | undefined {
    const cursorOffset = document.offsetAt(position)
    return findFunctions(document)
        .filter(
            callable =>
                cursorOffset >= callable.start && cursorOffset <= callable.end,
        )
        .sort((left, right) => left.start - right.start)
        .at(-1)
}
