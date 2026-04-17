export { buildFunctionPayload } from './core/payload/payload-function'
export { buildMethodPayload } from './core/payload/payload-method'

import { buildEvalPayload } from './core/payload/payload-eval'
import { buildMethodPayload } from './core/payload/payload-method'
import type { PayloadBuildOptions } from './core/payload/payload-types'
import { prepareEvalSource } from './core/prepare/prepare-eval-source'

export function buildTinkerPayload(options: PayloadBuildOptions): string {
    if (options.method) {
        return buildMethodPayload(options)
    }

    return buildEvalPayload({
        ...options,
        preparedUserCode:
            options.preparedUserCode ??
            prepareEvalSource(
                options.selectionOrFileCode ?? '',
                options.smartCapture,
            ),
    })
}
