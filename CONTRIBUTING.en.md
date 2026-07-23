# Contributing

**English** | [中文](CONTRIBUTING.md)

Thanks for your interest in the Cindy protocol repository. This repo is the
**single source of truth for the wire protocols shared** between Cindy's client
and server. Consuming repositories reference it as a git submodule — which means
every line changed here is a cross-repo contract change, so the process and
discipline are stricter than a typical repository.

## Contribution scope

This repo is open-sourced primarily to **unblock external local development**:
the server code is not open source, but the server and client share this
protocol — publishing it (the client mounts it as a git submodule) is what lets
external developers fully clone the client, `pnpm install`, and build / debug it
locally. In other words, this repo is mostly a **prerequisite dependency** for
developing against the client, not the main arena for external contributions.

By contribution type:

- **Docs / translations** (e.g. translating `docs/*.md` to English),
  **validator (parse) bug fixes**, **additional tests**, **tooling / CI**:
  external PRs are welcome and can be reviewed and merged on their own, with no
  server-side coordination needed.
- **Protocol-semantic changes** (new message types / fields / envelope / routing
  semantics / constants): these require coordinated server + client
  implementation, and **the server is closed-source** — so they are led by
  maintainers through the two-stage flow below. If you have an idea, open a
  [protocol proposal issue](../../issues/new/choose) first; a maintainer
  implements it.
- **Security issues**: see [SECURITY.md](SECURITY.md).

## Development environment

- Node.js >= 22, pnpm 10.x
- `pnpm install` — install dependencies
- `pnpm test` — run all tests
- `pnpm typecheck` — `tsc` check across every package

## Which repository should I open a PR against?

- **Changing only client/server code**: open the PR in the corresponding
  consuming repository; you don't need to touch this repo. Remember to
  `git clone --recurse-submodules`.
- **Changing the protocol itself** (message types, fields, envelope, routing
  semantics, constants): open a PR here and follow the two-stage flow below.

## Two-stage protocol-change flow

Because a consuming repo's submodule pointer can only reference a commit that is
**already merged** here, a protocol change proceeds in two steps:

1. **PR in this repo**: the protocol change + parse validation + tests + docs
   (the relevant section under `docs/`) submitted together, with the motivation
   and compatibility impact spelled out. Wait for it to merge.
2. **PR in the consuming repo(s)**: after the PR here merges, open a PR in each
   consuming repo — bump the submodule pointer to the new commit and include the
   consumer-side adaptations.

> Pointing a consuming repo's submodule at a commit that only exists in your fork
> does not work: the upstream CI cannot fetch objects that live only in your fork.

## PR conventions

- **One logical change per PR**: keeps review and rollback clean; don't mix a
  protocol change with unrelated refactors.
- **Branch naming**: `<type>/<short-description>`, with `type` matching the commit
  type (`feat`/`fix`/`docs`/…), e.g. `feat/slack-hook-multi-team`,
  `fix/device-link-version-check`.
- **PR description**: state the motivation and compatibility impact, and complete
  the repo's PR-template checklist (especially the "trio" for protocol changes).
- **Where new message types/fields go and how to extend**: see the
  "extension guide / versioning" section of the relevant protocol doc —
  [slack-hook §9](docs/slack-hook-protocol.md),
  [device-link §9](docs/device-link-protocol.md),
  [voice](docs/voice-protocol.md).

## Protocol-evolution discipline (hard rules)

1. **Zero runtime dependencies**: no package here may introduce a runtime
   dependency.
2. **`device-link-protocol` and `voice-protocol` must be React Native-safe**: no
   `node:*` and no Node-only imports (mobile compiles these packages' source
   directly).
3. **Append-only first**: prefer adding optional fields / new message types over
   changing the semantics of existing fields. Every new optional field must
   document each side's degradation behavior "when the peer is an older version".
4. **Each protocol's compatibility strategy differs — don't mix them up**:
   - `slack-hook-protocol`: `type` is an open set; an older peer that receives an
     unknown type drops the frame without disconnecting — new message types are
     inherently backward-compatible, but you must define the degraded experience.
   - `device-link-protocol`: the relay silently drops unknown kinds (the sender
     experiences a timeout black hole) — adding a kind that needs relaying is a
     **both-sides-upgrade-together** change; the `EnvelopeKind` set and
     `PROTOCOL_VERSION` must move in lockstep.
   - `plugin-protocol`: the manifest and the client HTTP envelope are versioned
     independently. Unknown optional fields may be ignored; an unsupported
     manifest or envelope version must be rejected outright — the client keeps
     its existing installs and never applies a partial update.
   - `skill-protocol`: the publish manifest and client HTTP envelope are versioned
     independently. Unknown optional fields may be ignored; unsupported versions
     must be rejected, and a failed client update retains the existing Skill.
   - `voice-protocol`: session request/response allow unknown fields and roll out
     via optional fields; the refiner business payload strictly rejects unknown
     fields to prevent project-key abuse. A missing `protocolVersion` is
     interpreted as v1; an explicitly unsupported version is rejected.
5. **Incompatible changes must bump the protocol version**, and the PR must state
   the upgrade-window plan for the consuming repos.
6. **Changing a protocol means changing the trio**: type definition + parse-time
   runtime validation (error messages carry the field path) + tests (at minimum
   round-trip and bad-frame rejection). Behavioral/semantic changes also update
   the corresponding doc under `docs/`.

## Test requirements

- New message type / new field: add a round-trip case plus rejection cases for
  the field-interaction constraints.
- Test fixtures must use neutral placeholder values (`cindy`, `example.com`,
  etc.). Do not use real email addresses, real organization names, or internal
  system identifiers.

## Commit messages

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
`<type>(<scope>): <subject>`.

- **type**: `feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `ci` / `revert`
- **scope**: `slack-hook` / `device-link` / `plugin` / `voice` / `docs` / `repo`
- **subject**: imperative mood, no trailing period; `type`/`scope` in English,
  the subject may be English or Chinese.
- **Breaking changes**: append `!` after the type (e.g. `feat(device-link)!: ...`),
  write a `BREAKING CHANGE:` note in the body, and **bump the corresponding
  protocol version in the same commit** (see rule 5 above).

The repo ships a commit template; after cloning, run it once so `git commit`
prints the format hint:

```bash
git config commit.template .gitmessage
```

See [docs/commit-convention.md](docs/commit-convention.md) for the reference
(currently Chinese).

## License and contribution grant

This repository is released under the [Apache License 2.0](LICENSE). Unless you
explicitly state otherwise, any contribution you intentionally submit for
inclusion is licensed under the same terms, per Section 5 of Apache-2.0.
