import { describe, expect, it } from 'vitest'
import { ToTinkerCodeLensProvider } from '../src/code-lens'
import { createTextDocument } from './helpers'

describe('code lens', () => {
    it('creates run lenses for top-level functions and class methods', () => {
        const document = createTextDocument(`<?php
function build_report() {
    return true;
}

class Runner {
    private static function make() {
        return true;
    }
}
`)
        const provider = new ToTinkerCodeLensProvider()
        const lenses = provider.provideCodeLenses(document)

        expect(lenses).toHaveLength(2)
        expect(lenses[0]?.command?.command).toBe('toTinker.runFunctionAt')
        expect(lenses[1]?.command?.command).toBe('toTinker.runMethodAt')
        expect(lenses[0]?.command?.title).toBe('$(play) To Tinker: Run')
        expect(lenses[1]?.command?.title).toBe('$(play) To Tinker: Run')
    })
})
