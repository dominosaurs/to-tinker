import {
    buildSandboxPrelude,
    mapLiteral,
    quote,
    renderResultPhp,
} from './payload-common'
import type { PayloadBuildOptions } from './payload-types'

export function buildMethodPayload(options: PayloadBuildOptions): string {
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
