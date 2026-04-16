# To Tinker

Run any PHP or Laravel code in one click from VS Code ⚡

To Tinker is a VS Code extension that lets you run selected PHP, full files, and class methods without leaving the editor. It uses Laravel Tinker under the hood so you can execute real application code fast, with less setup and less context switching.

## ✨ Features

- ✂️ Run selections with smart expression capture
- 📍 Run current line from editor title bar
- 📄 Run full PHP files inside Laravel app
- 🧠 Run class methods with CodeLens support
- 🖥️ Show results in dedicated side panel
- 🛡️ Toggle sandbox on or off when needed

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
