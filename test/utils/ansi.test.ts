import { describe, expect, it } from 'vitest'
import { stripAnsi } from '../../src/ansi'

describe('stripAnsi', () => {
    it('removes terminal escape codes', () => {
        expect(stripAnsi('\u001b[31merror\u001b[0m')).toBe('error')
    })
})
