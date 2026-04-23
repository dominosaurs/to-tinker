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
        ...buildTransactionPrelude(),
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

function buildTransactionPrelude(): string[] {
    return [
        '$__toTinkerConnections = [];',
        '$__toTinkerWrappedConnectionIds = [];',
        '$__toTinkerWrapConnection = static function ($__toTinkerConnection) use (&$__toTinkerConnections, &$__toTinkerWrappedConnectionIds): void {',
        '    if (!is_object($__toTinkerConnection)) {',
        '        return;',
        '    }',
        '    try {',
        '        $__toTinkerConnectionId = spl_object_hash($__toTinkerConnection);',
        '    } catch (Throwable $__toTinkerHashError) {',
        '        return;',
        '    }',
        '    if (isset($__toTinkerWrappedConnectionIds[$__toTinkerConnectionId])) {',
        '        return;',
        '    }',
        '    $__toTinkerWrappedConnectionIds[$__toTinkerConnectionId] = true;',
        '    try {',
        "        if (method_exists($__toTinkerConnection, 'transactionLevel') && $__toTinkerConnection->transactionLevel() > 0) {",
        '            $__toTinkerConnections[] = $__toTinkerConnection;',
        '            return;',
        '        }',
        "        if (method_exists($__toTinkerConnection, 'beginTransaction')) {",
        '            $__toTinkerConnection->beginTransaction();',
        '            $__toTinkerConnections[] = $__toTinkerConnection;',
        '        }',
        '    } catch (Throwable $__toTinkerConnectionError) {',
        '    }',
        '};',
        'try {',
        "    $__toTinkerEvents = app('events');",
        "    if (is_object($__toTinkerEvents) && method_exists($__toTinkerEvents, 'listen')) {",
        '        $__toTinkerEvents->listen(\\Illuminate\\Database\\Events\\ConnectionEstablished::class, function ($__toTinkerEvent) use (&$__toTinkerWrapConnection): void {',
        "            if (is_object($__toTinkerEvent) && property_exists($__toTinkerEvent, 'connection')) {",
        '                $__toTinkerWrapConnection($__toTinkerEvent->connection);',
        '            }',
        '        });',
        '    }',
        '} catch (Throwable $__toTinkerListenerError) {',
        '}',
        'try {',
        "    $__toTinkerDb = app('db');",
        "    if (is_object($__toTinkerDb) && method_exists($__toTinkerDb, 'getConnections')) {",
        '        foreach ((array) $__toTinkerDb->getConnections() as $__toTinkerConnection) {',
        '            $__toTinkerWrapConnection($__toTinkerConnection);',
        '        }',
        '    }',
        '} catch (Throwable $__toTinkerExistingConnectionError) {',
        '}',
        "foreach ((array) config('database.connections', []) as $__toTinkerName => $__toTinkerConfig) {",
        "    if (!is_string($__toTinkerName) || $__toTinkerName === '') {",
        '        continue;',
        '    }',
        "    if (!is_array($__toTinkerConfig) || (($__toTinkerConfig['driver'] ?? null) === 'sqlite')) {",
        '        continue;',
        '    }',
        '    try {',
        "        $__toTinkerOptions = (array) ($__toTinkerConfig['options'] ?? []);",
        '        $__toTinkerOptions[\\PDO::ATTR_TIMEOUT] = (int) ($__toTinkerOptions[\\PDO::ATTR_TIMEOUT] ?? 2);',
        "        config(['database.connections.' . $__toTinkerName . '.options' => $__toTinkerOptions]);",
        "        if (!isset($__toTinkerConfig['connect_timeout'])) {",
        "            config(['database.connections.' . $__toTinkerName . '.connect_timeout' => 2]);",
        '        }',
        '    } catch (Throwable $__toTinkerConnectionConfigError) {',
        '    }',
        '}',
        "foreach ((array) config('database.connections', []) as $__toTinkerName => $__toTinkerConfig) {",
        "    if (!is_string($__toTinkerName) || $__toTinkerName === '') {",
        '        continue;',
        '    }',
        "    if (!is_array($__toTinkerConfig) || (($__toTinkerConfig['driver'] ?? null) !== 'sqlite')) {",
        '        continue;',
        '    }',
        '    try {',
        '        $__toTinkerWrapConnection(\\Illuminate\\Support\\Facades\\DB::connection((string) $__toTinkerName));',
        '    } catch (Throwable $__toTinkerSqliteConnectionError) {',
        '    }',
        '}',
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
