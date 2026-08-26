# Git Workflow

This document defines the Git and GitHub workflow for every project contributor.

## 1. Branch structure

| Branch | Purpose | Rules |
| --- | --- | --- |
| `main` | Code that is running in, or ready for, production | Only accepts merges from `dev`; no direct pushes. |
| `dev` | Integration branch for the staging environment | Only accepts merges through Pull Requests (PRs); no direct pushes. |
| `feature/*` | A new feature or task | Created from `dev`; merged back into `dev` when complete. |
| `fix/*` | A non-urgent bug fix | Created from `dev`; merged back into `dev`. |
| `hotfix/*` | An urgent production fix | Created from `main`; merged into `main`, then synchronized back to `dev`. |

Do not create long-lived branches by discipline, such as `FE` or `BE`. Each branch must represent one specific unit of work and may include both frontend and backend changes.

## 2. Branch naming

Use lowercase letters and hyphens (`-`). Prefix the branch name with the ticket or issue ID when one exists.

```text
feature/123-user-login
feature/payment-api
fix/245-invalid-phone-validation
hotfix/payment-webhook-timeout
```

## 3. Task workflow

1. Update `dev` before starting work:

   ```bash
   git switch dev
   git pull origin dev
   ```

2. Create a branch for the work:

   ```bash
   git switch -c feature/123-user-login
   ```

3. Make small, purposeful commits. Push regularly for backup and CI checks; do not wait until the entire task is complete before pushing.

4. Before opening a PR, update the branch with `dev`, resolve any conflicts, and test the change yourself.

5. Open a PR from `feature/*` or `fix/*` into `dev`. Link the relevant issue or task in the PR description.

6. Merge only after all required checks pass and the review requirements of the team are met.

7. Delete the merged feature or fix branch on GitHub and locally when it is no longer needed.

## 4. Commits and Pull Requests

### Commits

- Each commit should make one clear, focused change.
- Never commit secrets, `.env` files, tokens, private keys, or production data.
- Do not combine unrelated changes in one PR.
- Use concise messages such as:

  ```text
  feat: add user login endpoint
  fix: validate Vietnamese phone number
  docs: add deployment notes
  refactor: extract auth middleware
  ```

### Pull Requests

Every PR must include:

- A description of the problem and the changes made.
- A link to the related issue or task, if applicable.
- Test steps or proof of testing.
- Screenshots or video for UI changes.
- Any required migration, environment variable, or configuration change.

Do not merge your own PR when the team requires review. Do not merge when CI or tests fail unless the exception is explicitly agreed upon.

## 5. Testing before merging into `dev`

The PR author is responsible for running checks appropriate to the change:

- Linting and formatting.
- Unit and integration tests, when available.
- Application build.
- Manual testing of the affected user flow.
- API contract checks when a change affects both frontend and backend.

`dev` is the integration branch. Do not merge `dev` into `main` while staging is unstable or contains critical defects.

## 6. Release process

When a group of features has been fully tested on `dev`/staging:

1. Create a PR from `dev` to `main`.
2. Review it, run CI, and verify release notes and migrations.
3. Merge into `main` and deploy to production through the project deployment process.
4. Create a version tag when the project uses versioning, for example `v1.2.0`.

## 7. Production hotfixes

Use `hotfix/*` only when a defect is affecting production and needs immediate release.

```bash
git switch main
git pull origin main
git switch -c hotfix/payment-webhook-timeout
```

After testing:

1. Open a PR from `hotfix/*` to `main` and deploy it to production.
2. Bring the same change back into `dev` with a `main` to `dev` PR or a cherry-pick, so it is included in the next release.

## 8. GitHub branch protection

Configure branch protection for `main` and `dev`:

- Require a Pull Request before merging.
- Require CI checks to pass.
- Require at least one approval when the team has two or more members.
- Block force pushes and deletion of protected branches.
- Require the source branch to be up to date with the target branch before merging when this suits the team's pace.

## 9. General principles

- Always pull the latest changes before starting or resuming work.
- Discuss changes to shared APIs, database schemas, or configuration early.
- Do not edit `main` or `dev` directly as a quick fix without explicit approval from the release owner.
- Keep PRs small, focused, and easy to review.
