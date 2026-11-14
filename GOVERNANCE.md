# Governance and release policy

## Maintainer control

`teemukinos` is the sole repository owner and the only account with write/admin permissions. Contributors use forks and pull requests. Do not grant write access to collaborators, bots, apps or deploy keys. Account credentials can act as the owner and must remain private.

After the initial documentation bootstrap, every change to `main` requires a PR, including the owner's changes. Configure:

- Required pull request, with zero required additional approvals.
- Rules enforced for administrators; no bypass.
- Force pushes and branch deletion disabled.
- Squash merges only; automatic merging disabled.
- No required CI, extra independent reviews, merge queue or remote workflows.

Zero extra approvals lets the sole maintainer merge their own PRs. Community members cannot merge because they have no write permission. No CODEOWNERS approval requirement is imposed.

Private-repository branch protection depends on the GitHub account plan. If GitHub does not support it, keep this repository private and owner-only. Report the enforcement gap rather than claiming that a convention is enforced. Do not upgrade a plan or make the repository public without authorization. Enable and verify protection at public launch.

## Public release

Wait for the owner's explicit public-release instruction. Before changing visibility:

1. Inspect the full Git history and current tracked files locally for credentials, operational data and unlicensed assets.
2. Confirm code licensing, third-party notices and media permissions.
3. Verify only the owner has write access and no integration can merge or push.
4. Change visibility only as specifically authorized. Enable and verify main-branch protection immediately if private-plan restrictions previously prevented it.
5. Verify squash-only/manual merging, no force pushes, no deletion and no administrator bypass before inviting contributions.
6. Publish contribution instructions. Website deployment and domain changes remain separate actions.

Do not test protection by attempting destructive pushes. Verify settings through read-only GitHub API responses. Do not automatically merge the initial application PR.
