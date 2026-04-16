export { buildFunctionPayload } from './core/payload/payload-function'
export { buildMethodPayload } from './core/payload/payload-method'
export type { PayloadBuildOptions as WrapperOptions } from './core/payload/payload-types'

import { buildEvalPayload } from './core/payload/payload-eval'
import { buildMethodPayload } from './core/payload/payload-method'
import type { PayloadBuildOptions } from './core/payload/payload-types'

export function buildTinkerPayload(options: PayloadBuildOptions): string {
    if (options.method) {
        return buildMethodPayload(options)
    }

    return buildEvalPayload(options)
}
