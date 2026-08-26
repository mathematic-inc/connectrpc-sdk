# Connect SDK

Generates idiomatic, namespaced client SDKs from ConnectRPC schemas, for
TypeScript and Rust.

A Connect schema names methods so they stand alone. `CreateWorkspace` says
what it creates because nothing around it does. A generated client groups
those methods by service, so the name repeats itself:

```ts
client.workspaceService.createWorkspace(request);
```

This generator groups them by resource and drops the repetition:

```ts
client.workspaces.create(request);
```

It does not reimplement Connect. `protoc-gen-es` and
`protoc-gen-connect-rust` already generate working clients; this emits a
facade over them that decides only what the methods are called and how they
are grouped. Serialization, streaming, cancellation, and error mapping stay
where they were.

## The naming rule

For a service `[Resource]Service`, the namespace is the pluralized resource,
and each method drops the resource its namespace already names:

| RPC | Reads as |
| --- | --- |
| `WorkspaceService.ListWorkspaces` | `workspaces.list` |
| `WorkspaceService.CreateWorkspace` | `workspaces.create` |
| `WorkspaceService.GetWorkspaceOverview` | `workspaces.getOverview` |
| `ExportService.ListExportRuns` | `exports.listRuns` |
| `AccountService.GetAccountStatus` | `accounts.getStatus` |

Two rules keep it from over-reaching.

A method naming no resource keeps every word, because there is nothing to
remove: `WorkspaceService.SetDraftMode` stays `workspaces.setDraftMode`.

Only a *leading* occurrence is removed. `ExportService.ListEntityExports`
lists the exports of an entity rather than a collection of entities, so it
stays `exports.listEntityExports`. Removing the resource wherever it appeared
would name it `exports.listEntity`, which reads as listing entities.

Matching is on whole words, not substrings, so
`AccountService.ListAccountingPeriods` derives `listAccountingPeriods` rather
than `listingPeriods`.

Pluralization comes from [`pluralize`](https://www.npmjs.com/package/pluralize),
so the irregular resources English actually has come out right on their own:
`PersonService` gives `people`, `ChildService` gives `children`, and
`AnalyticsService` stays `analytics`.

## Overriding a derived name

The derivation follows a schema's naming, which is occasionally not the
naming its callers want. Two annotations correct it:

```proto
import "connectsdk/v1/annotations.proto";

service WorkspaceService {
  // `projects`, because that is what the product calls them.
  option (connectsdk.v1.namespace) = "projects";

  rpc ListEntityExports(ListEntityExportsRequest) returns (ListEntityExportsResponse) {
    option (connectsdk.v1.method) = "listForEntity";
  }
}
```

Set one only where the derived name is wrong; a redundant override is a
second place to change a name.

Two services may declare the same namespace, which is how a schema presents
one client-facing surface that it implements as several services. Where two
methods in a namespace derive the same name, generation fails and names the
method to annotate rather than silently keeping one of them.

## TypeScript

```yaml
# buf.gen.yaml
version: v2
plugins:
  - local: protoc-gen-es
    out: src/gen
    opt: [target=ts, import_extension=js]
  - local: protoc-gen-connect-sdk
    out: src/gen
    opt: [target=ts, import_extension=js]
```

One client per proto package, beside the messages it is built from:

```ts
import { createSloperDesktopClient } from "./gen/sloper/desktop/v1/client.js";

const client = createSloperDesktopClient(transport);

const overview = await client.workspaces.getOverview({ workspaceId });
for await (const batch of client.events.subscribe({})) {
  // ...
}
```

Method signatures are read off the generated service descriptors rather than
restated, so request and response types stay exactly what `protoc-gen-es`
produced, and a schema change reaches callers without this generator knowing
what changed.

## Rust

```yaml
version: v2
plugins:
  - local: protoc-gen-connect-sdk
    out: src/generated
    strategy: all
    opt:
      - language=rust
      - service_path=crate::generated::service
      - message_path=crate::generated::messages
      - extern_path=.google.protobuf=::buffa_types::google::protobuf
```

The shape follows `async-openai`: one client owning the transport, with
borrowed group structs reached through accessors.

```rust
let client = SloperDesktopClient::new(transport, config);

let overview = client.workspaces().get_overview(request).await?;
let mut events = client.events().subscribe(request).await?;
```

Unary methods return the response message rather than the transport's
`UnaryResponse`, since headers and trailers are a detail of the hop; a caller
who wants them can reach the generated client directly. Streaming methods
return the stream itself.

`service_path` and `message_path` name where the generated clients and
messages live. `extern_path` follows the spelling the message and service
generators already take, and is needed for the same reason: a well-known type
such as `google.protobuf.Empty` lives in `buffa_types` rather than beside the
package's own messages.

### Bring your own types

The `byot` feature adds a `*_byot` twin of every method, generic over request
and response, for sending a type this schema does not describe:

```rust
let response = client
    .workspaces()
    .create_byot::<_, MyResponseView>(my_request)
    .await?;
```

The wire call is identical; only the types at the edges change.

## Contributing

Start with a [GitHub Discussion](../../discussions/new) and wait for a
maintainer to review the proposal. We use AI agents to implement approved
changes, so we do not review unsolicited pull requests. GitHub restricts pull
request creation to Mathematic maintainers and repository collaborators with
write, maintain, or admin access, plus authorized maintenance agents. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full process.

## License

MIT or Apache-2.0, at your option.
