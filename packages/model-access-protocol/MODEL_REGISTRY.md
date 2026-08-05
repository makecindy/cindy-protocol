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

Schema v2 additionally allows `newSessionDefault` as Cindy's catalog-level
recommendation for the initial model of a new conversation, scoped by agent
harness. It is global catalog policy, not an account preference or a live
availability claim. A client applies it only among models that are currently
available and visible, and it never overrides an explicit user selection or an
already-running session.

`updatedAt` is a canonical UTC ISO timestamp in `Date#toISOString()` form.
For one route, reference-price entries with the same currency and variant must
not overlap in both their effective-date interval and input-token interval.
Both interval upper bounds are exclusive, so adjacent schedules and bands are
valid while ambiguous array-order precedence is rejected.

It must not contain client runtime provenance, account state, or user
preferences. In particular, fields such as `contextWindowExplicit`,
`contextWindowVerified`, discovery timestamps, local override markers, live
availability, and Cindy AI / XD Gateway sale prices belong to their respective
client, discovery, or gateway layers.

## Presence, entitlement, and sale availability

Three concepts must never be conflated, and only the first one lives in this
registry:

- **Catalog presence** (this registry): a canonical model exists in Cindy's
  public catalog, reachable through the listed provider routes and agent
  harnesses, with the curated metadata and lifecycle status above.
- **Live entitlement / availability** (never in the registry): whether a given
  account, subscription, or session can invoke a model right now. This is
  owned by client-side discovery and runtime verification, such as dynamic
  provider model lists and session capability checks.
- **Gateway sale availability and actual prices** (never in the registry):
  whether Cindy AI / XD Gateway currently sells a model and at what price.
  This is owned by the Gateway `/models` endpoint and billing.

The registry's wire fields carry the same meaning for every consumer; what
differs is how much of the presence signal a client chooses to consume:

- **Legacy and overlay-only consumers** enrich models they already know from
  discovery or the Gateway with registry metadata. They never create models
  from the registry. This behavior remains valid and unchanged.
- **Policy-based materialization** (newer clients): a client MAY derive
  locally selectable entries from registry routes, under a client-owned policy
  restricted to its built-in providers. Such a policy must require an explicit
  `status` and a self-consistent capability set — `contextWindow`, `efforts`,
  and a `defaultEffort` consistent with them (an empty `efforts` list means a
  fixed-effort model and implies no default). Entries without an explicit
  `status` stay metadata-only and must never materialize; this is the
  backward-compatibility gate that keeps registry snapshots written before
  materialization existed from silently growing into selectable models.

Materialized selectability is a client-derived presentation state, not an
availability claim by the registry: invocation can still fail entitlement, and
clients surface that failure at runtime. Client-derived agent harnesses beyond
`MODEL_ACCESS_AGENTS` (for example projection-based harnesses) are a client
concern; routes never name them.

## Lifecycle status

`status` is the registry's only lifecycle signal:

- `active` marks a current catalog entry; `preview` marks a pre-release stage
  of the catalog lifecycle that clients may badge.
- `deprecated` models remain routable; clients should de-emphasize or hide
  them by default while keeping explicit selection working.
- `retired` is the explicit end-of-life tombstone: clients must not newly
  materialize such routes and may suppress new selection of the model even
  when discovery still reports it. Sessions already running on the model are
  a client concern.
- **Omission is not retirement.** An entry or route missing from a newer
  snapshot only means it is no longer present in that catalog snapshot;
  clients must not infer deletion or retirement from absence, and
  discovery-proven models legitimately continue to exist.

## Revision discipline

`updatedAt` identifies an immutable complete Registry snapshot. Two snapshots
with the same `updatedAt` MUST have identical canonical JSON content; consumers
must reject and report a same-revision content change. A correction or rollback
is published as the desired complete content with a later `updatedAt`
(forward-fix), never by moving the timestamp backwards or rewriting an existing
revision. The package exports `modelRegistryCanonicalJson` so client and server
guards use the same normalization.

A schema-version change changes the canonical snapshot content and therefore
MUST publish a later `updatedAt`; a v1 and v2 snapshot must never reuse the same
revision even when their model entries are otherwise equivalent.

## Schema versions

- **v1** is the original strict Registry shape and does not allow
  `newSessionDefault`.
- **v2** adds optional `ModelRegistryEntry.newSessionDefault`. When present it
  must be a unique, non-empty array of supported Cindy agents, and every listed
  agent must occur on at least one route of that entry. It is independent of
  `sortOrder` (picker ordering) and `defaultEnabled` (default visibility). If
  more than one available and visible model is marked for an agent, clients
  prefer the one with the lowest `sortOrder` and use stable catalog order as the
  final tie-breaker.

The current parser accepts both v1 and v2 and applies a separate strict field
allowlist to each version. It rejects unknown versions instead of partially
interpreting them. This dual-reader behavior lets consumers deploy before a
publisher switches a Registry snapshot from v1 to v2.

## Change gate

Each version parser rejects every field outside its explicit allowlist. Adding
or repurposing a field therefore requires all of the following:

1. update the protocol types, strict parser, and contract tests together;
2. increment `MODEL_REGISTRY_SCHEMA_VERSION`;
3. document the cross-provider meaning and authority boundary here;
4. obtain approval from the registry code owner.

Consumers must treat an unsupported schema version as unavailable and fall
back to their last-known-good or bundled registry. They must not partially
interpret a newer version.
