# Contributing to Supanauts

Supanauts is an unofficial Supabase community. Contributions are welcome through pull requests once the repository becomes public. Private access is not currently being offered to community contributors.

## Workflow

1. Fork the repository once public and create a focused feature branch.
2. Use your own local or hosted development Supabase project. Never request production keys, guest lists or real reward codes.
3. Keep changes small and explain the behavior, purpose and local verification in the PR description.
4. Run `npm ci`, `npm run typecheck`, and `npm run build` in `site/`. Check affected flows locally with synthetic data only.
5. Submit a PR targeting `main`. Teemu decides what to merge and performs the squash merge.

All changes, including maintainer changes, use PRs. Do not add collaborators with write access, automated merging, remote tests, test files, CI workflows, independent review bots or deployment integrations without explicit owner authorization. Existing required checks must never be bypassed.

Do not commit credentials, real email addresses from guest lists, codes, private screenshots, local chat history or event photos. Generated verification output stays local. The committed ignore rules are a guardrail, not a substitute for inspecting the staged diff.

Preserve keyboard access, visible focus indicators, reduced-motion behavior and the motion pause control. Official Supabase logo files must remain unchanged and use the variant appropriate to the background. Keep the unofficial community identity explicit.

Contributions to the original code are provided under Apache-2.0. Preserve applicable third-party notices and attribution. No CLA or extra review service is required.

Report sensitive security issues privately to the maintainer rather than posting secrets in public issues.
