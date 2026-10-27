# Project instructions

Before performing any Git-related action—including creating or switching branches, committing, pulling, pushing, opening or merging a pull request, releasing, or resolving a hotfix—read and follow [GIT_WORKFLOW.md](GIT_WORKFLOW.md).

## Documentation

- Read [docs/README.md](docs/README.md) and follow [docs/CONVENTIONS.md](docs/CONVENTIONS.md) before creating or updating project documentation.
- Store all new project Markdown documents under root `docs/<business-domain>/`, grouped by business capability across Web/API/Mobile. Update the existing canonical document when possible; do not recreate scattered `api/docs/`, `mobile/docs/`, or root business documents.
- Whenever a document is created, renamed, moved, or removed, update `docs/README.md` and any affected repository links in the same task. Use relative Markdown links and state the working directory for terminal commands.
- Keep root/module `AGENTS.md`, root `GIT_WORKFLOW.md`, and short README entry points in their expected locations. README entry points link to canonical content under `docs/`; avoid duplicate full documents.
- Keep planned work, implemented work, automated checks, and real-device verification distinct. Preserve business behavior when organizing docs and reconcile older specifications against current user requirements/code/schema rather than silently treating historical docs as current implementation.
- These documentation conventions persist for future tasks unless the user explicitly requests a different location or a tool requires one.
