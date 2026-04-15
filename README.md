# To Tinker

Run any PHP or Laravel code in one click from VS Code ⚡

To Tinker is a VS Code extension that lets you run selected PHP, full files, and class methods without leaving the editor. It uses Laravel Tinker under the hood so you can execute real application code fast, with less setup and less context switching.

## Why this exists

Most Laravel developers eventually do the same awkward loop:

- open a terminal
- start `php artisan tinker`
- copy and paste code
- or create a temporary route, command, controller action, or test just to try something quickly

To Tinker exists to remove that friction. It gives you a one-click way to run PHP and Laravel code directly from VS Code while still using Laravel Tinker as the execution path.

### ✂️ Run selections

Use it when you want to try a query, inspect a value, test a small snippet, or poke the container without building temporary scaffolding.

### 📄 Run files

Use it when a quick experiment becomes bigger than a snippet and you want a repeatable scratch script tied to your Laravel app.

### 🧠 Run methods

Use it when you want to execute a class method faster than wiring up a temporary route, command, or test harness just to reach that code path.

## 🛡️ Safety model

Sandbox is partial, not full isolation.

- Fakes `Mail`, `Notification`, `Event`, `Bus`, `Queue` 📬
- Optionally fakes `Storage` 💾
- Wraps opened DB connections in transactions and rolls them back 🗃️
- Still may allow non-faked side effects like network calls, filesystem writes outside fake disks, and framework behavior tied to commit semantics ⚠️

Use `Disable Sandbox` commands only when you want real execution.
