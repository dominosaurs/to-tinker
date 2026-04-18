import {
    buildSandboxPrelude,
    mapLiteral,
    quote,
    quoteBase64,
    renderResultPhp,
} from './payload-common'
import type { PayloadBuildOptions } from './payload-types'

export function buildFunctionPayload(options: PayloadBuildOptions): string {
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
