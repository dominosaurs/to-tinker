export function buildSandboxPrelude(
    enabled: boolean,
    fakeStorage: boolean,
): string[] {
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

export function renderResultPhp(includeBufferedOutput: boolean): string {
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
        '    echo "__TO_TINKER_META__\\n";',
        '    echo json_encode([',
        "        'type' => get_debug_type($__toTinkerResult),",
        "        'class' => is_object($__toTinkerResult) ? get_class($__toTinkerResult) : null,",
        '    ], JSON_UNESCAPED_SLASHES) . "\\n";',
        '    echo "\\n__TO_TINKER_DIAGNOSTICS__\\n";',
        '    echo \'elapsed_ms=\' . $__toTinkerElapsedMs . "\\n";',
        '}',
    ].join('\n')
}

export function quote(value: string): string {
    return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

export function quoteBase64(value: string): string {
    return quote(Buffer.from(value, 'utf8').toString('base64'))
}

export function mapLiteral(values: Record<number, string>): string {
    return `[${Object.entries(values)
        .map(([key, value]) => `${key} => ${quote(value)}`)
        .join(', ')}]`
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
        '        $__toTinkerJson = json_encode($__toTinkerResult, JSON_PRETTY_PRINT);',
        '        if ($__toTinkerJson !== false) {',
        '            echo $__toTinkerJson . "\\n";',
        '        } else {',
        '            print_r($__toTinkerResult);',
        '        }',
        '    } elseif ($__toTinkerResult instanceof \\Illuminate\\Database\\Eloquent\\Model || $__toTinkerResult instanceof \\Illuminate\\Database\\Eloquent\\Collection) {',
        '        echo json_encode($__toTinkerResult->toArray(), JSON_PRETTY_PRINT) . "\\n";',
        '    } else {',
        ...renderObjectDumpPhp('        '),
        '    }',
    ]
}

function renderObjectDumpPhp(indent: string): string[] {
    return [
        `${indent}if (function_exists('dump')) {`,
        `${indent}    ob_start();`,
        `${indent}    dump($__toTinkerResult);`,
        `${indent}    $__toTinkerDump = trim(ob_get_clean());`,
        `${indent}    echo ($__toTinkerDump !== '' ? $__toTinkerDump : get_debug_type($__toTinkerResult)) . "\\n";`,
        `${indent}} else {`,
        `${indent}    $__toTinkerClass = get_debug_type($__toTinkerResult);`,
        `${indent}    $__toTinkerShortClass = str_contains($__toTinkerClass, '\\\\')`,
        `${indent}        ? substr($__toTinkerClass, strrpos($__toTinkerClass, '\\\\') + 1)`,
        `${indent}        : $__toTinkerClass;`,
        `${indent}    echo $__toTinkerShortClass . " object\\n";`,
        `${indent}}`,
    ]
}
