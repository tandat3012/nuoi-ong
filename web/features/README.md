# Feature conventions

Each top-level folder represents one V1 business capability, not one database table or one page.

Add subfolders only when the feature needs them:

- `api/` for feature-specific endpoint functions.
- `components/` for feature UI.
- `hooks/` for client-side orchestration.
- `schemas/` for form and API validation.
- `types/` for types owned by the feature.

Routes in `app/` should remain thin and compose exports from these feature folders. Generic UI, API transport, configuration, and cross-feature types belong in `shared/`.
