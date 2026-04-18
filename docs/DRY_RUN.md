# Dry Run Mode (Experimental)

Dry Run mode is a **best-effort development tool** designed to prevent accidental side-effects while experimenting with PHP and Laravel code. It aims to provide a "safety net" for local development, allowing you to iterate faster without manually cleaning up after every run.

## How it Works

To Tinker leverages Laravel's native testing infrastructure to intercept common side-effects:

1. **Database:** Connections are wrapped in transactions and issued a `rollback` after execution.
2. **Mailing & Notifications:** Uses the `Mail` and `Notification` fakes.
3. **Events & Jobs:** Uses `Event`, `Bus`, and `Queue` fakes to prevent background processing.
4. **Storage (Optional):** Can fake Laravel's `Storage` disks.

## Technical Boundaries

Because PHP is a highly dynamic language, no interception is 100% perfect. Developers should be aware of these boundaries:

- **Direct System Calls:** Low-level calls (e.g., `curl`, `file_put_contents`, direct PDO) bypass framework-level fakes.
- **Database Commit Semantics:** Certain database operations (like DDL statements) may cause implicit commits in some engines, bypassing transactions.
- **Environment Context:** Always ensure your active workspace is pointed at the intended environment. Dry Run is a tool for local experimentation, not a substitute for a staging environment.

## 🤝 Help make it better

To Tinker is open source, and the Dry Run feature is only as strong as its community. 

- **Found a leak?** If you discover a common Laravel side-effect that isn't being caught, please open an issue or a PR.
- **Future-proofing:** Help us track changes in Laravel's internals to ensure Dry Run remains a reliable tool for everyone.

Check out the [Contribution Guide](https://github.com/dominosaurs/to-tinker/blob/main/CONTRIBUTING.md) to get started.
