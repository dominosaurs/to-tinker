# To Tinker

VS Code extension for running Laravel PHP selections, files, and methods through `php artisan tinker`.

## Safety model

Sandbox is partial, not full isolation.

- Fakes `Mail`, `Notification`, `Event`, `Bus`, `Queue`
- Optionally fakes `Storage`
- Wraps opened DB connections in transactions and rolls them back
- Still may allow non-faked side effects like network calls, filesystem writes outside fake disks, and framework behavior tied to commit semantics

Use `Disable Sandbox` commands only when you want real execution.

## Requirements

- VS Code `^1.99.0`
- PHP `^8.2`
- Laravel project with `artisan`

## Commands

- `Run Selection`
- `Run Selection (Disable Sandbox)`
- `Run File`
- `Run File (Disable Sandbox)`
- `Run Method`
- `Run Method (Disable Sandbox)`

## Settings

- `toTinker.phpPath`
- `toTinker.timeoutSeconds`
- `toTinker.clearOutputOnRun`
- `toTinker.sandbox.defaultEnabled`
- `toTinker.sandbox.fakeStorage`
