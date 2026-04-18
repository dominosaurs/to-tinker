import { describe, expect, it } from 'vitest'
import { shouldShowRunFileForText } from '../../../src/core/discovery/top-level-file-shape'

describe('top-level file shape', () => {
    it('hides run file for class-only php files', () => {
        expect(
            shouldShowRunFileForText(`<?php
namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;

class UserController
{
    public function index(Request $request)
    {
        return [];
    }
}
`),
        ).toBe(false)
    })

    it('shows run file for function-only php files', () => {
        expect(
            shouldShowRunFileForText(`<?php
use Illuminate\\Support\\Str;

function slugify(string $value): string
{
    return Str::slug($value);
}
`),
        ).toBe(true)
    })

    it('shows run file for files with top-level executable statements', () => {
        expect(
            shouldShowRunFileForText(`<?php
use Illuminate\\Foundation\\Inspiring;

$quote = Inspiring::quote();
return $quote;
`),
        ).toBe(true)
    })

    it('shows run file for mixed class and top-level executable content', () => {
        expect(
            shouldShowRunFileForText(`<?php
class Runner {}

return 42;
`),
        ).toBe(true)
    })
})
