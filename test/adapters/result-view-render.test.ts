import { describe, expect, it } from 'vitest'
import { detectLanguage } from '../../src/result-view-render'

describe('result view render', () => {
    it('detects dump-like object output as php for highlighting', () => {
        expect(
            detectLanguage(
                'selection',
                `Illuminate\\Database\\Eloquent\\Builder {#7622
  #query: Illuminate\\Database\\Query\\Builder {#7626
    +connection: Illuminate\\Database\\SQLiteConnection {#856}
  }
}`,
                false,
            ),
        ).toBe('php')
    })

    it('keeps plain text output as text', () => {
        expect(detectLanguage('selection', 'hello world', false)).toBe('text')
    })

    it('detects var_export scalar output as php for highlighting', () => {
        expect(detectLanguage('selection', "'hello world'", false)).toBe('php')
        expect(detectLanguage('selection', 'true', false)).toBe('php')
        expect(detectLanguage('selection', 'NULL', false)).toBe('php')
        expect(detectLanguage('selection', '42', false)).toBe('php')
    })
})
