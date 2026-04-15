import type { MethodInfo } from './extraction'

export interface WrapperOptions {
    sandboxEnabled: boolean
    fakeStorage: boolean
    filePath: string
    method?: MethodInfo
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

    return [
        ...buildSandboxPrelude(options.sandboxEnabled, options.fakeStorage),
        options.selectionOrFileCode.trim(),
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
        '$__toTinkerElapsedStart = microtime(true);',
        'try {',
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
        '    if ($__toTinkerReflector->isStatic()) {',
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
        '} catch (Throwable $__toTinkerCaught) {',
        '    $__toTinkerException = $__toTinkerCaught;',
        '}',
        '$__toTinkerElapsedMs = (int) round((microtime(true) - $__toTinkerElapsedStart) * 1000);',
        renderResultPhp(),
        '',
    ].join('\n')
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

function renderResultPhp(): string {
    return [
        'if ($__toTinkerException) {',
        '    echo "__TO_TINKER_ERROR__\\n";',
        '    echo $__toTinkerException;',
        '    echo "\\n__TO_TINKER_DIAGNOSTICS__\\n";',
        '    echo \'elapsed_ms=\' . $__toTinkerElapsedMs . "\\n";',
        '} else {',
        '    echo "__TO_TINKER_RESULT__\\n";',
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
        '    echo "\\n__TO_TINKER_DIAGNOSTICS__\\n";',
        '    echo \'elapsed_ms=\' . $__toTinkerElapsedMs . "\\n";',
        '}',
    ].join('\n')
}

function quote(value: string): string {
    return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

function mapLiteral(values: Record<number, string>): string {
    return `[${Object.entries(values)
        .map(([key, value]) => `${key} => ${quote(value)}`)
        .join(', ')}]`
}
