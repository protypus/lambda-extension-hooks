# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2025-04-17
### Added
- Initial release of `lambda-extension-hooks`
- Support for both **internal** and **external** AWS Lambda extensions
- Lifecycle hook registration: `onInit`, `onInvoke`, `onShutdown`
- Graceful shutdown on `SIGINT` and `SIGTERM`
- Clean ESM support (`"type": "module"`)
- Exported single entrypoint via `exports` map in `package.json`

---

## [Unreleased]
### Planned
- Improve error tracing and structured logging
