# Public Model Registry Contract

`ModelRegistry` is the canonical, provider-independent contract for Cindy's
server-delivered public model metadata and reference prices.

## Authority boundary

The registry may contain only facts that remain meaningful across clients and
accounts:

- canonical model identity and provider routes;
- supported Cindy agent harnesses;
- public capability metadata such as context window, output limit, effort
  levels, and Fast support;
- public provider reference prices with effective dates and traceable sources.

It must not contain client runtime provenance, account state, or user
preferences. In particular, fields such as `contextWindowExplicit`,
`contextWindowVerified`, discovery timestamps, local override markers, live
availability, and Cindy AI / XD Gateway sale prices belong to their respective
client, discovery, or gateway layers.

## Change gate

The version 1 parser rejects every field outside its explicit allowlist. Adding
or repurposing a field therefore requires all of the following:

1. update the protocol types, strict parser, and contract tests together;
2. increment `MODEL_REGISTRY_SCHEMA_VERSION`;
3. document the cross-provider meaning and authority boundary here;
4. obtain approval from the registry code owner.

Consumers must treat an unsupported schema version as unavailable and fall
back to their last-known-good or bundled registry. They must not partially
interpret a newer version.
