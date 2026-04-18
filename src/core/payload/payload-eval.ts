import {
    buildSandboxPrelude,
    quoteBase64,
    renderResultPhp,
} from './payload-common'
import type { PayloadBuildOptions } from './payload-types'

export function buildEvalPayload(options: PayloadBuildOptions): string {
    if (!options.preparedUserCode) {
        throw new Error('Missing PHP payload.')
    }

    return [
        ...buildSandboxPrelude(options.sandboxEnabled, options.fakeStorage),
        `$__toTinkerUserCode = base64_decode(${quoteBase64(options.preparedUserCode)});`,
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
