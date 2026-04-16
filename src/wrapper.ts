import type { FunctionInfo, MethodInfo } from './extraction'

export interface WrapperOptions {
    sandboxEnabled: boolean
    fakeStorage: boolean
    filePath: string
    method?: MethodInfo
    callableFunction?: FunctionInfo
    functionDeclarationSource?: string
    smartCapture?: boolean
    selectionOrFileCode?: string
    promptedArguments?: Record<number, string>
}

export function buildTinkerPayload(options: WrapperOptions): string {
    if (options.method) {
        return buildMethodPayload(options)
    }

    if (!options.selectionOrFileCode) {
        throw new Error('Missing PHP payload.')
    }

    const userCode = options.smartCapture
        ? prepareSmartCaptureCode(options.selectionOrFileCode)
        : options.selectionOrFileCode.trim()

    return [
        ...buildSandboxPrelude(options.sandboxEnabled, options.fakeStorage),
        `$__toTinkerUserCode = base64_decode(${quoteBase64(userCode)});`,
        '$__toTinkerResult = null;',
        '$__toTinkerEvalResult = null;',
        '$__toTinkerException = null;',
        "$__toTinkerBufferedOutput = '';",
        '$__toTinkerElapsedStart = microtime(true);',
        'try {',
        '    ob_start();',
        '    $__toTinkerEvalResult = eval($__toTinkerUserCode);',
        '    if (!is_null($__toTinkerEvalResult)) {',
        '        $__toTinkerResult = $__toTinkerEvalResult;',
        '    }',
        '    $__toTinkerBufferedOutput = ob_get_clean();',
        '} catch (Throwable $__toTinkerCaught) {',
        '    $__toTinkerBufferedOutput = ob_get_clean();',
        '    $__toTinkerException = $__toTinkerCaught;',
        '}',
        '$__toTinkerElapsedMs = (int) round((microtime(true) - $__toTinkerElapsedStart) * 1000);',
        renderResultPhp(true),
        '',
    ].join('\n')
}

export function buildMethodPayload(options: WrapperOptions): string {
    const method = options.method
    if (!method) {
        throw new Error('Missing method metadata.')
    }

    const args = options.promptedArguments ?? {}

    return [
        ...buildSandboxPrelude(options.sandboxEnabled, options.fakeStorage),
        `$__toTinkerFile = ${quote(options.filePath)};`,
        `$__toTinkerPromptedArgs = ${mapLiteral(args)};`,
        '$__toTinkerResult = null;',
        '$__toTinkerException = null;',
        "$__toTinkerBufferedOutput = '';",
        '$__toTinkerElapsedStart = microtime(true);',
        'try {',
        '    ob_start();',
        '    require_once $__toTinkerFile;',
        `    $__toTinkerReflector = new ReflectionMethod(${quote(method.fullyQualifiedClassName)}, ${quote(method.methodName)});`,
        '    $__toTinkerDeclaringClass = $__toTinkerReflector->getDeclaringClass()->getName();',
        '    $__toTinkerArgs = [];',
        '    foreach ($__toTinkerReflector->getParameters() as $__toTinkerIndex => $__toTinkerParameter) {',
        '        $__toTinkerType = $__toTinkerParameter->getType();',
        '        if (array_key_exists($__toTinkerIndex, $__toTinkerPromptedArgs)) {',
        "            $__toTinkerArgs[] = eval('return ' . $__toTinkerPromptedArgs[$__toTinkerIndex] . ';');",
        '            continue;',
        '        }',
        '        if ($__toTinkerType instanceof ReflectionNamedType && !$__toTinkerType->isBuiltin()) {',
        '            $__toTinkerArgs[] = app($__toTinkerType->getName());',
        '            continue;',
        '        }',
        '        if ($__toTinkerParameter->isDefaultValueAvailable()) {',
        '            $__toTinkerArgs[] = $__toTinkerParameter->getDefaultValue();',
        '            continue;',
        '        }',
        "        throw new RuntimeException('Unresolved parameter: $' . $__toTinkerParameter->getName());",
        '    }',
        "    if ($__toTinkerReflector->getName() === '__construct') {",
        '        $__toTinkerResult = new $__toTinkerDeclaringClass(...$__toTinkerArgs);',
        '    } elseif ($__toTinkerReflector->isStatic()) {',
        '        $__toTinkerResult = $__toTinkerReflector->invokeArgs(null, $__toTinkerArgs);',
        '    } else {',
        '        $__toTinkerInstance = app($__toTinkerDeclaringClass);',
        '        $__toTinkerProperties = (new ReflectionObject($__toTinkerInstance))->getProperties();',
        '        foreach ($__toTinkerProperties as $__toTinkerProperty) {',
        '            if ($__toTinkerProperty->isStatic()) {',
        '                continue;',
        '            }',
        "            if (method_exists($__toTinkerProperty, 'isInitialized') && !$__toTinkerProperty->isInitialized($__toTinkerInstance)) {",
        "                throw new RuntimeException('Uninitialized property: ' . $__toTinkerProperty->getDeclaringClass()->getName() . '::$' . $__toTinkerProperty->getName());",
        '            }',
        '        }',
        '        $__toTinkerReflector->setAccessible(true);',
        '        $__toTinkerResult = $__toTinkerReflector->invokeArgs($__toTinkerInstance, $__toTinkerArgs);',
        '    }',
        '    $__toTinkerBufferedOutput = ob_get_clean();',
        '} catch (Throwable $__toTinkerCaught) {',
        '    $__toTinkerBufferedOutput = ob_get_clean();',
        '    $__toTinkerException = $__toTinkerCaught;',
        '}',
        '$__toTinkerElapsedMs = (int) round((microtime(true) - $__toTinkerElapsedStart) * 1000);',
        renderResultPhp(true),
        '',
    ].join('\n')
}

export function buildFunctionPayload(options: WrapperOptions): string {
    const callableFunction = options.callableFunction
    if (!callableFunction) {
        throw new Error('Missing function metadata.')
    }

    const args = options.promptedArguments ?? {}
    const declarationSource = options.functionDeclarationSource
        ? buildFunctionDeclarationSource(
              options.functionDeclarationSource,
              callableFunction.namespaceName,
          )
        : undefined

    return [
        ...buildSandboxPrelude(options.sandboxEnabled, options.fakeStorage),
        `$__toTinkerFile = ${quote(options.filePath)};`,
        `$__toTinkerFunction = ${quote(callableFunction.fullyQualifiedFunctionName)};`,
        ...(declarationSource
            ? [
                  `$__toTinkerFunctionDeclaration = base64_decode(${quoteBase64(declarationSource)});`,
              ]
            : []),
        `$__toTinkerPromptedArgs = ${mapLiteral(args)};`,
        '$__toTinkerResult = null;',
        '$__toTinkerException = null;',
        "$__toTinkerBufferedOutput = '';",
        '$__toTinkerElapsedStart = microtime(true);',
        'try {',
        '    ob_start();',
        ...(declarationSource
            ? ['    eval($__toTinkerFunctionDeclaration);']
            : ['    require_once $__toTinkerFile;']),
        '    if (!function_exists($__toTinkerFunction)) {',
        "        throw new RuntimeException('Function could not be loaded from this file.');",
        '    }',
        '    $__toTinkerReflector = new ReflectionFunction($__toTinkerFunction);',
        '    $__toTinkerArgs = [];',
        '    foreach ($__toTinkerReflector->getParameters() as $__toTinkerIndex => $__toTinkerParameter) {',
        '        if (array_key_exists($__toTinkerIndex, $__toTinkerPromptedArgs)) {',
        "            $__toTinkerArgs[] = eval('return ' . $__toTinkerPromptedArgs[$__toTinkerIndex] . ';');",
        '            continue;',
        '        }',
        '        if ($__toTinkerParameter->isDefaultValueAvailable()) {',
        '            $__toTinkerArgs[] = $__toTinkerParameter->getDefaultValue();',
        '            continue;',
        '        }',
        "        throw new RuntimeException('Unresolved parameter: $' . $__toTinkerParameter->getName());",
        '    }',
        '    $__toTinkerResult = $__toTinkerReflector->invokeArgs($__toTinkerArgs);',
        '    $__toTinkerBufferedOutput = ob_get_clean();',
        '} catch (Throwable $__toTinkerCaught) {',
        '    $__toTinkerBufferedOutput = ob_get_clean();',
        '    $__toTinkerException = $__toTinkerCaught;',
        '}',
        '$__toTinkerElapsedMs = (int) round((microtime(true) - $__toTinkerElapsedStart) * 1000);',
        renderResultPhp(true),
        '',
    ].join('\n')
}

function buildFunctionDeclarationSource(
    source: string,
    namespaceName?: string,
): string {
    const trimmed = source.trim()
    if (!namespaceName) {
        return trimmed
    }

    return `namespace ${namespaceName};\n${trimmed}`
}

function buildSandboxPrelude(enabled: boolean, fakeStorage: boolean): string[] {
    if (!enabled) {
        return []
    }

    return [
        '\\Illuminate\\Support\\Facades\\Mail::fake();',
        '\\Illuminate\\Support\\Facades\\Notification::fake();',
        '\\Illuminate\\Support\\Facades\\Event::fake();',
        '\\Illuminate\\Support\\Facades\\Bus::fake();',
        '\\Illuminate\\Support\\Facades\\Queue::fake();',
        ...(fakeStorage
            ? ['\\Illuminate\\Support\\Facades\\Storage::fake();']
            : []),
        '$__toTinkerConnections = [];',
        "foreach (array_keys(config('database.connections', [])) as $__toTinkerName) {",
        '    try {',
        '        $__toTinkerConnection = \\Illuminate\\Support\\Facades\\DB::connection($__toTinkerName);',
        '        $__toTinkerConnection->beginTransaction();',
        '        $__toTinkerConnections[] = $__toTinkerConnection;',
        '    } catch (Throwable $__toTinkerConnectionError) {',
        '    }',
        '}',
        'register_shutdown_function(function () use (&$__toTinkerConnections) {',
        '    foreach ($__toTinkerConnections as $__toTinkerConnection) {',
        '        while ($__toTinkerConnection->transactionLevel() > 0) {',
        '            try {',
        '                $__toTinkerConnection->rollBack();',
        '            } catch (Throwable $__toTinkerRollbackError) {',
        '                break;',
        '            }',
        '        }',
        '    }',
        '});',
    ]
}

function renderResultPhp(includeBufferedOutput: boolean): string {
    return [
        'if ($__toTinkerException) {',
        '    echo "__TO_TINKER_ERROR__\\n";',
        ...(includeBufferedOutput
            ? [
                  "    if ($__toTinkerBufferedOutput !== '') {",
                  '        echo $__toTinkerBufferedOutput;',
                  '        echo "\\n";',
                  '    }',
              ]
            : []),
        '    echo $__toTinkerException;',
        '    echo "\\n__TO_TINKER_DIAGNOSTICS__\\n";',
        '    echo \'elapsed_ms=\' . $__toTinkerElapsedMs . "\\n";',
        '} else {',
        '    echo "__TO_TINKER_RESULT__\\n";',
        ...(includeBufferedOutput
            ? [
                  "    if ($__toTinkerBufferedOutput !== '') {",
                  '        echo $__toTinkerBufferedOutput;',
                  '        if (!str_ends_with($__toTinkerBufferedOutput, "\\n")) {',
                  '            echo "\\n";',
                  '        }',
                  '    }',
                  ...renderValuePhp(
                      "    if ($__toTinkerBufferedOutput !== '') {",
                  ),
              ]
            : [...renderValuePhp('    if (true) {')]),
        '    echo "\\n__TO_TINKER_DIAGNOSTICS__\\n";',
        '    echo \'elapsed_ms=\' . $__toTinkerElapsedMs . "\\n";',
        '}',
    ].join('\n')
}

function renderValuePhp(ifLine: string): string[] {
    return [
        `${ifLine}`,
        '    }',
        '    if (is_null($__toTinkerResult) || is_scalar($__toTinkerResult)) {',
        '        echo var_export($__toTinkerResult, true) . "\\n";',
        '    } elseif ($__toTinkerResult instanceof \\Illuminate\\Contracts\\Support\\Arrayable) {',
        '        echo json_encode($__toTinkerResult->toArray(), JSON_PRETTY_PRINT) . "\\n";',
        '    } elseif ($__toTinkerResult instanceof JsonSerializable) {',
        '        echo json_encode($__toTinkerResult, JSON_PRETTY_PRINT) . "\\n";',
        '    } elseif (is_array($__toTinkerResult)) {',
        '        print_r($__toTinkerResult);',
        '    } elseif ($__toTinkerResult instanceof \\Illuminate\\Database\\Eloquent\\Model || $__toTinkerResult instanceof \\Illuminate\\Database\\Eloquent\\Collection) {',
        '        echo json_encode($__toTinkerResult->toArray(), JSON_PRETTY_PRINT) . "\\n";',
        '    } else {',
        '        print_r($__toTinkerResult);',
        '    }',
    ]
}

function prepareSmartCaptureCode(source: string): string {
    const trimmed = source.trim()
    if (!trimmed) {
        throw new Error(
            'Selection is not a complete PHP statement or standalone expression. Select a full statement, or a complete expression like $user->email.',
        )
    }

    const { statements, trailing } = splitTopLevelStatements(trimmed)
    const normalizedTrailing = isCommentOnlyFragment(trailing) ? '' : trailing

    if (statements.length === 0) {
        return normalizeSingleStatementOrExpression(trimmed)
    }

    if (!normalizedTrailing) {
        const normalizedStatements = [...statements]
        const lastStatement = normalizedStatements.at(-1)

        if (lastStatement && isCapturableStatement(lastStatement)) {
            normalizedStatements[normalizedStatements.length - 1] =
                renderCapturedStatement(lastStatement)
        }

        return normalizedStatements.join('\n')
    }

    if (isCapturableStatement(normalizedTrailing)) {
        return [
            ...statements,
            renderCapturedStatement(normalizedTrailing),
        ].join('\n')
    }

    if (isObviouslyUnsupportedFragment(normalizedTrailing)) {
        throw new Error(
            'Selection is not a complete PHP statement or standalone expression. Select a full statement, or a complete expression like $user->email.',
        )
    }

    return [...statements, ensureTrailingSemicolon(normalizedTrailing)].join(
        '\n',
    )
}

function normalizeSingleStatementOrExpression(source: string): string {
    if (isCapturableStatement(source)) {
        return renderCapturedStatement(source)
    }

    if (isObviouslyUnsupportedFragment(source)) {
        throw new Error(
            'Selection is not a complete PHP statement or standalone expression. Select a full statement, or a complete expression like $user->email.',
        )
    }

    return ensureTrailingSemicolon(source)
}

function splitTopLevelStatements(source: string): {
    statements: string[]
    trailing: string
} {
    const statements: string[] = []
    let current = ''
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false
    let inLineComment = false
    let inBlockComment = false

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        const next = source[index + 1]
        const previous = source[index - 1]

        current += character

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

        if (character === '(') {
            parenDepth += 1
        } else if (character === ')') {
            parenDepth = Math.max(0, parenDepth - 1)
        } else if (character === '[') {
            bracketDepth += 1
        } else if (character === ']') {
            bracketDepth = Math.max(0, bracketDepth - 1)
        } else if (character === '{') {
            braceDepth += 1
        } else if (character === '}') {
            braceDepth = Math.max(0, braceDepth - 1)
            if (
                braceDepth === 0 &&
                parenDepth === 0 &&
                bracketDepth === 0 &&
                isTopLevelDeclarationBlock(current)
            ) {
                const statement = current.trim()
                if (statement) {
                    statements.push(statement)
                }
                current = ''
                continue
            }
        }

        if (
            character === ';' &&
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0
        ) {
            const statement = current.trim()
            if (statement) {
                statements.push(statement)
            }
            current = ''
        }
    }

    return {
        statements,
        trailing: current.trim(),
    }
}

function isTopLevelDeclarationBlock(source: string): boolean {
    const trimmed = stripInsignificant(source)
    return /^(function|class|trait|interface|enum)\b/.test(trimmed)
}

function isStandaloneExpression(source: string): boolean {
    const trimmed = stripTrailingSemicolon(stripInsignificant(source))
    if (!trimmed || isObviouslyUnsupportedFragment(trimmed)) {
        return false
    }

    if (
        /^(if|foreach|for|while|switch|try|catch|finally|function|fn|class|trait|interface|enum|namespace|use|return|echo|print|throw|break|continue|unset|global|static|public|protected|private|final|abstract|readonly|declare|do)\b/.test(
            trimmed,
        )
    ) {
        return false
    }

    return true
}

function isCapturableStatement(source: string): boolean {
    const trimmed = stripInsignificant(source)
    if (!trimmed) {
        return false
    }

    return (
        isStandaloneExpression(trimmed) ||
        hasTopLevelAssignment(stripTrailingSemicolon(trimmed)) ||
        hasTopLevelIncrementOrDecrement(stripTrailingSemicolon(trimmed))
    )
}

function isObviouslyUnsupportedFragment(source: string): boolean {
    const trimmed = stripTrailingSemicolon(stripInsignificant(source))
    if (!trimmed) {
        return true
    }

    if (!hasBalancedStructure(trimmed)) {
        return true
    }

    if (hasTopLevelDoubleArrow(trimmed)) {
        return true
    }

    return /(?:=>|,|::|->|=|:|\{)$/u.test(trimmed)
}

function hasBalancedStructure(source: string): boolean {
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        const previous = source[index - 1]

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

        if (character === '(') {
            parenDepth += 1
        } else if (character === ')') {
            parenDepth -= 1
        } else if (character === '[') {
            bracketDepth += 1
        } else if (character === ']') {
            bracketDepth -= 1
        } else if (character === '{') {
            braceDepth += 1
        } else if (character === '}') {
            braceDepth -= 1
        }

        if (parenDepth < 0 || bracketDepth < 0 || braceDepth < 0) {
            return false
        }
    }

    return (
        !inSingleQuote &&
        !inDoubleQuote &&
        parenDepth === 0 &&
        bracketDepth === 0 &&
        braceDepth === 0
    )
}

function hasTopLevelAssignment(source: string): boolean {
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        const previous = source[index - 1]
        const next = source[index + 1]

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

        if (character === '(') {
            parenDepth += 1
            continue
        }

        if (character === ')') {
            parenDepth = Math.max(0, parenDepth - 1)
            continue
        }

        if (character === '[') {
            bracketDepth += 1
            continue
        }

        if (character === ']') {
            bracketDepth = Math.max(0, bracketDepth - 1)
            continue
        }

        if (character === '{') {
            braceDepth += 1
            continue
        }

        if (character === '}') {
            braceDepth = Math.max(0, braceDepth - 1)
            continue
        }

        if (
            character === '=' &&
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0 &&
            next !== '>' &&
            previous !== '=' &&
            previous !== '!' &&
            previous !== '<' &&
            previous !== '>' &&
            previous !== '?'
        ) {
            return true
        }
    }

    return false
}

function hasTopLevelDoubleArrow(source: string): boolean {
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        const previous = source[index - 1]
        const next = source[index + 1]

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

        if (character === '(') {
            parenDepth += 1
            continue
        }

        if (character === ')') {
            parenDepth = Math.max(0, parenDepth - 1)
            continue
        }

        if (character === '[') {
            bracketDepth += 1
            continue
        }

        if (character === ']') {
            bracketDepth = Math.max(0, bracketDepth - 1)
            continue
        }

        if (character === '{') {
            braceDepth += 1
            continue
        }

        if (character === '}') {
            braceDepth = Math.max(0, braceDepth - 1)
            continue
        }

        if (
            character === '=' &&
            previous === '>' &&
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0
        ) {
            return true
        }

        if (
            character === '=' &&
            next === '>' &&
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0
        ) {
            return true
        }
    }

    return false
}

function hasTopLevelIncrementOrDecrement(source: string): boolean {
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let index = 0; index < source.length - 1; index += 1) {
        const character = source[index]
        const next = source[index + 1]
        const previous = source[index - 1]

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

        if (character === '(') {
            parenDepth += 1
            continue
        }

        if (character === ')') {
            parenDepth = Math.max(0, parenDepth - 1)
            continue
        }

        if (character === '[') {
            bracketDepth += 1
            continue
        }

        if (character === ']') {
            bracketDepth = Math.max(0, bracketDepth - 1)
            continue
        }

        if (character === '{') {
            braceDepth += 1
            continue
        }

        if (character === '}') {
            braceDepth = Math.max(0, braceDepth - 1)
            continue
        }

        if (
            parenDepth === 0 &&
            bracketDepth === 0 &&
            braceDepth === 0 &&
            ((character === '+' && next === '+') ||
                (character === '-' && next === '-'))
        ) {
            return true
        }
    }

    return false
}

function renderCapturedStatement(source: string): string {
    const trimmed = stripInsignificant(source)
    return `$__toTinkerResult = (${stripTrailingSemicolon(trimmed)});`
}

function stripInsignificant(source: string): string {
    let trimmed = stripTrailingInsignificant(source)

    while (trimmed.length > 0) {
        const nextLineComment = trimmed.match(/^\s*\/\/[^\n]*(?:\n|$)/)
        if (nextLineComment) {
            trimmed = trimmed.slice(nextLineComment[0].length)
            continue
        }

        const nextBlockComment = trimmed.match(/^\s*\/\*[\s\S]*?\*\//)
        if (nextBlockComment) {
            trimmed = trimmed.slice(nextBlockComment[0].length)
            continue
        }

        break
    }

    return trimmed.trim()
}

function stripTrailingInsignificant(source: string): string {
    let trimmed = source

    while (trimmed.length > 0) {
        const withoutWhitespace = trimmed.replace(/\s+$/u, '')
        if (withoutWhitespace !== trimmed) {
            trimmed = withoutWhitespace
            continue
        }

        const withoutLineComment = trimmed.replace(/\s*\/\/[^\n]*$/u, '')
        if (withoutLineComment !== trimmed) {
            trimmed = withoutLineComment
            continue
        }

        const withoutBlockComment = trimmed.replace(/\s*\/\*[\s\S]*?\*\/$/u, '')
        if (withoutBlockComment !== trimmed) {
            trimmed = withoutBlockComment
            continue
        }

        break
    }

    return trimmed.trim()
}

function isCommentOnlyFragment(source: string): boolean {
    return stripInsignificant(source) === ''
}

function ensureTrailingSemicolon(source: string): string {
    return `${stripTrailingSemicolon(source)};`
}

function stripTrailingSemicolon(source: string): string {
    return source.trim().replace(/;+$/u, '').trim()
}

function quote(value: string): string {
    return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

function quoteBase64(value: string): string {
    return quote(Buffer.from(value, 'utf8').toString('base64'))
}

function mapLiteral(values: Record<number, string>): string {
    return `[${Object.entries(values)
        .map(([key, value]) => `${key} => ${quote(value)}`)
        .join(', ')}]`
}
