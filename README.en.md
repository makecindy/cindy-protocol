# cindy-protocol

**English** | [中文](README.md)

The single source of truth for the **wire protocols shared** between the Cindy
client and server repositories. Each side mounts this repository as a git
submodule and includes `packages/*` in its own pnpm workspace (source-shipped,
no build artifacts).

## Admission rule

Only protocols that the **server actually needs to parse/validate** belong here.
Purely client-to-client, end-to-end types that are opaque to the server stay in
the client repository.

## Packages

| Package                        | Contents                                                                                                                                                                                                  | Consumers                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `@cindy/slack-hook-protocol`   | hook server ↔ desktop duplex task protocol: envelope, message types, runtime validation, builders                                                                                                         | desktop (hook-control), slack-hook-server                               |
| `@cindy/device-link-protocol`  | device-link relay-layer protocol: envelope, routing semantics (ROUTED/CONTROL kinds), connection-layer payloads. Tunnel-layer payloads are opaque to the relay and stay in the client device-link package | desktop/mobile (device-link package), device-link-server                |
| `@cindy/plugin-protocol`       | Ghost package `ghost.json` types and validator, plus the Plugin list/detail/download DTOs and response parsers the Desktop client needs                                                                   | plugin-server; Desktop consumes it in a later remote-Plugin integration |
| `@cindy/skill-protocol`        | Skill package manifests plus the Skill list/detail/download DTOs and response parsers the Desktop client needs                                                                                            | plugin-server Skill Domain and the Desktop Skill marketplace            |
| `@cindy/voice-protocol`        | desktop/mobile ↔ voice-server voice control plane: sessions, one-shot tickets, ASR target descriptors, refine payloads, and runtime validation                                                            | desktop, mobile, voice-server                                           |
| `@cindy/model-access-protocol` | model-access-server ↔ desktop/mobile model catalog responses, price currency, and runtime validation                                                                                                      | model-access-server, desktop/mobile model pickers                       |

## Protocol docs

- [slack-hook-protocol](docs/slack-hook-protocol.md) — hook server ↔ desktop duplex task protocol (envelope, 24 message types, reliability & compatibility strategy)
- [device-link-protocol](docs/device-link-protocol.md) — device-interconnect relay-layer protocol (dumb-relay model, routing semantics, security semantics)
- [plugin-protocol](docs/plugin-protocol.md) — Ghost manifest and Plugin HTTP delivery contract (version boundaries, compatibility strategy)
- [skill-protocol](docs/skill-protocol.md) — Skill package manifest and marketplace HTTP delivery contract (scopes and compatibility strategy)
- [voice-protocol](docs/voice-protocol.md) — voice control-plane protocol (sessions, one-shot tickets, refine payloads, compatibility strategy)
- [model-access-protocol](docs/model-access-protocol.md) — model catalog, price currency, and compatibility

> The protocol docs are currently Chinese-only. English translations are
> welcome — see [CONTRIBUTING](CONTRIBUTING.en.md).

## How to consume

A consuming repository mounts this as a submodule (by convention at a path that
matches the repo name: `cindy-protocol/`, so the pointer is visible in the tree)
and adds to its `pnpm-workspace.yaml`:

```yaml
packages:
  - 'cindy-protocol/packages/*'
```

Then depend on the packages as usual: `"@cindy/slack-hook-protocol": "workspace:*"`.

Every protocol package is source-shipped; this repository produces no build
artifacts. A pure Node production process cannot load TypeScript from
`node_modules`, so server-side consumers must inline the protocol packages they
use into their own bundle at build time (`tsup`'s `noExternal`).

## Contributing

This repo is open-sourced primarily to **unblock external local development**:
the server code is not open source, but the server and client share this
protocol — publishing it (the client mounts it as a git submodule) is what lets
external developers fully clone the client, `pnpm install`, and build / debug it
locally. In other words, this repo is mostly a **prerequisite dependency** for
developing against the client, not the main arena for external contributions.

By contribution type: **docs / translations, validator (parse) bug fixes, tests,
and tooling** are welcome as external PRs (mergeable on their own);
**protocol-semantic changes that touch the server** are landed by maintainers
through the two-stage flow (the server is closed-source) — if you have an idea,
open a [protocol proposal issue](../../issues/new/choose) first. See the
"Contribution scope" section of [CONTRIBUTING](CONTRIBUTING.en.md) for details;
the commit message format is in [the commit convention](docs/commit-convention.md).

## License

Released under the [Apache License 2.0](LICENSE) (copyright holder: XD Inc.;
see [NOTICE](NOTICE)). Unless stated otherwise in writing, any contribution
you intentionally submit for inclusion in this repository is licensed under the
same terms, per Section 5 of Apache-2.0.

## Change discipline

- A protocol is a cross-repo contract: **append-only first**. Incompatible
  changes must bump the protocol version (e.g. device-link's `PROTOCOL_VERSION`)
  and bump the submodule pointer in every consuming repo within the same window.
- Zero runtime dependencies is a hard constraint: no package here may introduce
  any runtime dependency. `device-link-protocol` and `voice-protocol` must
  additionally remain React Native-compilable (no Node-only imports; mobile
  consumes the source directly); `slack-hook-protocol` targets the Node
  environment (desktop main process / hook server) and may use the `node:*`
  standard library.
