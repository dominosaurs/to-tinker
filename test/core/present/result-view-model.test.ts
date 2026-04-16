import { describe, expect, it } from 'vitest'
import {
    buildResultViewModel,
    formatMode,
} from '../../../src/core/present/result-view-model'

describe('result view model', () => {
    it('builds contextual title and labels for selected code runs', () => {
        const model = buildResultViewModel(
            {
                status: 'success',
                summary: {
                    filePath: '/tmp/demo.php',
                    mode: 'selection',
                    rootPath: '/tmp',
                    sandboxEnabled: true,
                },
            },
            {
                name: 'To Tinker',
                version: '0.1.1',
            },
        )

        expect(model.title).toBe('Success · Selected Code · demo.php')
        expect(model.modeLabel).toBe('Selected Code')
        expect(model.fileLabel).toBe('demo.php')
        expect(model.sandboxLabel).toBe('sandbox')
        expect(model.sandboxTone).toBe('muted')
    })

    it('builds alert sandbox metadata and function target labels', () => {
        const model = buildResultViewModel(
            {
                diagnostics: 'elapsed_ms=9',
                status: 'error',
                summary: {
                    filePath: '/tmp/helpers.php',
                    functionName: 'build_report',
                    mode: 'function',
                    rootPath: '/tmp',
                    sandboxEnabled: false,
                },
            },
            {
                name: 'To Tinker',
                version: 'dev',
            },
        )

        expect(model.targetLabel).toBe('build_report')
        expect(model.elapsed).toBe('9 ms')
        expect(model.sandboxLabel).toBe('⚠ no sandbox')
        expect(model.sandboxTone).toBe('alert')
        expect(model.statusClassName).toBe('status-error')
    })

    it('formats fallback mode text predictably', () => {
        expect(formatMode('timeout')).toBe('Timeout')
    })
})
