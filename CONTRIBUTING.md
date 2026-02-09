# Contributing

## Development setup

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`

## Pull request expectations

- Include tests for behavior changes.
- Keep API additions backward-compatible unless accompanied by a major version plan.
- Document user-visible changes in README or docs.
- Add a changeset for all publishable changes.

## Commit and release process

- Create a changeset with `npm run changeset`.
- Open PR.
- Merge PR after CI is green.
- Release workflow publishes versions from merged changesets.
