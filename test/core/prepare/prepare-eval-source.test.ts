import { describe, expect, it } from 'vitest'
import {
    INCOMPLETE_SNIPPET_ERROR,
    prepareEvalSource,
} from '../../../src/core/prepare/prepare-eval-source'

describe('prepare eval source', () => {
    it('passes through plain eval source when smart capture is disabled', () => {
        expect(prepareEvalSource('  return 42;  ')).toBe('return 42;')
    })

    it('captures the final assignment value in smart mode', () => {
        expect(prepareEvalSource('$val = getValue2();', true)).toBe(
            '$__toTinkerResult = ($val = getValue2());',
        )
    })

    it('captures the final call after declarations and comments', () => {
        expect(
            prepareEvalSource(
                `// intro

function getValue1(): int {
    return 30000;
}

getValue1(); // call it`,
                true,
            ),
        ).toBe(`// intro

function getValue1(): int {
    return 30000;
}
$__toTinkerResult = (getValue1());`)
    })

    it('rejects incomplete fragments in smart mode', () => {
        expect(() => prepareEvalSource("'name' => $user->name", true)).toThrow(
            INCOMPLETE_SNIPPET_ERROR,
        )
    })
})
