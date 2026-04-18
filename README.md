# To Tinker

Run any PHP or Laravel code in one click from VS Code ⚡

To Tinker is a VS Code extension for Laravel and PHP developers who want to run real application code without opening a terminal, starting Tinker manually, or creating temporary routes, commands, and tests just to inspect a value.

<img width="640" style="max-width: 100%;" height="auto" alt="To Tinker Preview" src="https://github.com/user-attachments/assets/7b19fa72-5d01-4dcf-9c4e-641fefba9cfb" />

It runs through `php artisan tinker`, stays inside your Laravel app context, and lets you execute selections, files, methods, and functions directly from the editor.

## ✨ Features

- ⚡ Run PHP and Laravel code where you write it, without jumping to a terminal
- ✂️ Run current selection or whole file with smart last-value output
- 🧠 Run methods and functions directly from the editor with CodeLens and callable detection
- 🔁 Execute real Laravel app context through `php artisan tinker`, not a fake mini runtime
- 🖥️ See output in a dedicated result panel built for readable values, errors, and source context
- 🧪 Prevent accidental side-effects with Dry Run mode, then switch to real execution only when you mean it

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

## 🧪 Dry Run (Experimental)

Dry Run mode provides a **safety net** by intercepting common side-effects using Laravel's native fakes and transactions. It is designed to prevent accidental data changes or emails during local experimentation.

> [!TIP]
> **Experimental Feature:** While robust, Dry Run is a "best-effort" tool for development convenience. It is not a security boundary and should not be used against production data.

- 📬 Fakes `Mail`, `Notification`, `Event`, `Bus`, `Queue`
- 💾 Optionally fakes `Storage`
- 🗃️ Wraps DB connections in transactions and rolls them back

See the [Dry Run Documentation](docs/DRY_RUN.md) for technical details and **how to contribute** to making it even more solid.

Use the `To Tinker: Toggle Dry Run Mode` command to switch between modes.

## ⚙️ Configuration

Configure To Tinker in VS Code through Settings and search for `To Tinker`.

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `toTinker.codeLens.enabled` | `boolean` | `true` | Show To Tinker CodeLens above supported PHP methods. |
| `toTinker.phpPath` | `string` | `""` | Path to the PHP executable. Leave empty to use `php` from `PATH`. |
| `toTinker.sandbox.defaultEnabled` | `boolean` | `true` | Enable experimental Dry Run mode by default. |
| `toTinker.sandbox.fakeStorage` | `boolean` | `false` | Also fake Laravel storage disks inside Dry Run mode. |
| `toTinker.timeoutSeconds` | `number` | `15` | Timeout for the spawned `artisan tinker` process. |

## 🩺 Troubleshooting

| Problem | Likely cause | What to do |
| --- | --- | --- |
| `Open a PHP editor first.` | There is no active PHP editor. | Open a `.php` file and run the command again. |
| `No Laravel artisan file found...` | The active file is not inside a Laravel project root that contains `artisan`. | Open the project root in VS Code and run To Tinker from a PHP file inside that workspace. |
| `Configured PHP path is not executable...` | `toTinker.phpPath` points to the wrong location, or PHP is not available to the extension host. | Fix `toTinker.phpPath`, or clear it and use `php` from `PATH`. |
| Execution timed out | The Tinker process exceeded `toTinker.timeoutSeconds`. | Increase `toTinker.timeoutSeconds` or reduce the amount of work being run. |
