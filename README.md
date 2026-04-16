# To Tinker

Run any PHP or Laravel code in one click from VS Code ⚡

To Tinker is a VS Code extension for Laravel and PHP developers who want to run real application code without opening a terminal, starting Tinker manually, or creating temporary routes, commands, and tests just to inspect a value.

It runs through `php artisan tinker`, stays inside your Laravel app context, and lets you execute selections, files, methods, and functions directly from the editor.

## ✨ Features

- ⚡ Run PHP and Laravel code where you write it, without jumping to a terminal
- ✂️ Run current selection or whole file with smart last-value output
- 🧠 Run methods and functions directly from the editor with CodeLens and callable detection
- 🔁 Execute real Laravel app context through `php artisan tinker`, not a fake mini runtime
- 🖥️ See output in a dedicated result panel built for readable values, errors, and source context
- 🛡️ Stay safe by default with sandboxing, then switch to real side effects only when you mean it

## ⚙️ How It Works

- To Tinker runs your code through `php artisan tinker` inside the active Laravel workspace
- `To Tinker: File` executes whole file and prints final meaningful value
- `To Tinker: Run` is context-aware: selection runs selection, no selection runs current line
- Selecting a full function or method declaration promotes the run into callable mode instead of just evaluating raw source
- Results appear in a dedicated side panel with output, errors, elapsed time, and source context
- Dirty files are saved automatically before a run starts

## 🎯 Best For

- Checking the return value of helpers, queries, and service calls
- Trying Eloquent queries without switching to a terminal
- Inspecting formatted values while refactoring PHP code
- Running a method or function in real Laravel app context
- Quickly validating an idea before writing a test

## 📋 Requirements

- A Laravel project with an `artisan` file
- A PHP file opened inside a VS Code workspace folder
- PHP available in your `PATH`, or configured explicitly with `toTinker.phpPath`

## 🤔 Why this exists

Most Laravel developers eventually do the same awkward loop:

- open a terminal
- start `php artisan tinker`
- copy and paste code
- or create a temporary route, command, controller action, or test just to try something quickly

To Tinker exists to remove that friction. It gives you a one-click way to run PHP and Laravel code directly from VS Code while still using Laravel Tinker as the execution path.

## 🧭 Execution Model

- `To Tinker: File` means: run whole file and print last meaningful value
- `To Tinker: Run` with no selection means: usually run everything so far through current line, then print final value
- `To Tinker: Run` with selection means: usually run everything so far through end of selection, then print final value
- Inside functions and methods, line and partial selection runs fall back to snippet-only smart capture so incomplete callable context does not break execution
- Whole function selections run as functions
- Whole method selections run as methods
- Final value capture understands plain expressions, assignments, chained assignments, compound assignments, and increment/decrement expressions
- Comments are ignored structurally for final-value detection

## 🛡️ Safety model

Sandbox is partial, not full isolation.

- Fakes `Mail`, `Notification`, `Event`, `Bus`, `Queue` 📬
- Optionally fakes `Storage` 💾
- Wraps opened DB connections in transactions and rolls them back 🗃️
- Still may allow non-faked side effects like network calls, filesystem writes outside fake disks, and framework behavior tied to commit semantics ⚠️

Use the `To Tinker: Toggle Sandbox` command when you want real execution.

## ⚙️ Configuration

Configure To Tinker in VS Code through Settings and search for `To Tinker`.

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `toTinker.codeLens.enabled` | `boolean` | `true` | Show To Tinker CodeLens above supported PHP methods. |
| `toTinker.phpPath` | `string` | `""` | Path to the PHP executable. Leave empty to use `php` from `PATH`. |
| `toTinker.sandbox.defaultEnabled` | `boolean` | `true` | Enable the partial sandbox by default. |
| `toTinker.sandbox.fakeStorage` | `boolean` | `false` | Also fake Laravel storage disks inside sandboxed runs. |
| `toTinker.timeoutSeconds` | `number` | `15` | Timeout for the spawned `artisan tinker` process. |

## 🩺 Troubleshooting

| Problem | Likely cause | What to do |
| --- | --- | --- |
| `Open a PHP editor first.` | There is no active PHP editor. | Open a `.php` file and run the command again. |
| `No Laravel artisan file found...` | The active file is not inside a Laravel project root that contains `artisan`. | Open the project root in VS Code and run To Tinker from a PHP file inside that workspace. |
| `Configured PHP path is not executable...` | `toTinker.phpPath` points to the wrong location, or PHP is not available to the extension host. | Fix `toTinker.phpPath`, or clear it and use `php` from `PATH`. |
| Execution timed out | The Tinker process exceeded `toTinker.timeoutSeconds`. | Increase `toTinker.timeoutSeconds` or reduce the amount of work being run. |
