# Contributing to To Tinker ⚡

To Tinker is a simple bridge between VS Code and `php artisan tinker`. It's built for speed and local experimentation. If you're here, you probably want to make it better. Let's do it.

## 🧪 The "Dry Run" Challenge

The hardest part of this project is **Dry Run mode**. We're trying to intercept Laravel side-effects (Mail, DB, Jobs) without actually having a real sandbox. We use Fakes and Transactions. It's a "safety net," but it's not perfect.

**We need your help to find the leaks.**

If you use a package or a Laravel feature that Dry Run doesn't catch yet:
1. Find where we build the "Prelude" in `src/core/payload/payload-common.ts`.
2. Add the interception logic (usually a `Facade::fake()`).
3. Add a test case that proves it's now caught.

## 🛠️ Tech Stack

- **TypeScript** (Strict)
- **Bun** (Runtime, Test Runner, Package Manager)
- **Vitest** (Testing)

## 🏃 Local Dev

```bash
bun install
bun run test      # Run the suite
bun run lint      # Check types and style
```

## 🚀 How to PR

1. **Keep it surgical.** Don't refactor the world. Fix the leak or add the feature.
2. **Prove it.** Every PR needs a test. If you fix a bug, the test should fail without your change and pass with it.
3. **Be idiomatic.** We like clean, readable TypeScript. No `any`, no magic.

## ⚖️ License

Contributions are under the **MIT License**. By submitting a PR, you're cool with that.
