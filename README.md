# Backslash Graph Query API

A small read-only REST API that loads the supplied Train Ticket service graph and returns complete directed routes matching optional filters. It includes a dependency-free browser UI served by the same Bun process. The implementation uses pure Bun HTTP APIs, vanilla HTML/CSS/JavaScript, Zod validation, and `bun:test`.

## Decisions and assumptions

The assignment does not define the exact meaning of a route, so this solution uses the following explicit rules:

- A route is a complete directed simple path. Without boundary filters, it runs from a root node (no incoming edges) to a leaf node (no outgoing edges).
- With `startsPublic=true`, traversal starts at every `publicExposed: true` node, even if that node has incoming edges.
- With `endsInSink=true`, traversal stops when it reaches an `rds` or `sql` node, even if that node has outgoing edges.
- A route contains at least one edge. An isolated node is not a route.
- A node is not visited twice within one route, so cyclic input cannot cause infinite traversal.
- Provided filters are combined with AND semantics.
- A sink for `endsInSink` is a node whose `kind` is `rds` or `sql` (case-insensitive), rather than any leaf node.
- `true` selects routes that satisfy a condition; `false` explicitly selects routes that do not satisfy it; an omitted filter is ignored.
- The graph is loaded once at startup. Dataset changes require an application restart.
- The query engine is not tied to the supplied Train Ticket dataset. Any JSON file that satisfies the documented `nodes` and `edges` schema can be loaded through `GRAPH_DATA_PATH`.
- The application works with one graph per process. Runtime uploads, graph IDs, persistence, and simultaneous querying of multiple graphs are intentionally outside the assignment scope.
- Route enumeration is protected by `maxDepth` and `maxRoutes`. Very deep or highly branching graphs may produce an intentionally incomplete result, which is explicitly reported through `meta.truncated: true`.

The supplied dataset contains two edges to a missing `assurance-service` node. The default lenient loader skips those edges and exposes warnings through API metadata and `/health`. Domain code also supports strict reference validation.

## Architecture

```text
HTTP request
    -> pure Bun Router
    -> static vanilla frontend or API controller
    -> RouteQueryService
    -> graph traversal + filter registry
    -> in-memory Graph loaded from JSON
```

HTTP, filesystem loading, graph traversal, and route filters are separate. A new route filter is added to `src/domain/route-filter.ts`; controllers and traversal do not need to change.

## Browser UI

Open `http://localhost:3000` after starting the application. The vanilla frontend provides:

- checkboxes for all three route filters;
- route, node, and edge counts;
- a scrollable native SVG visualization;
- a readable list of matching paths with vulnerable services highlighted by severity;
- severity colors for critical, high, medium, and low vulnerabilities in both the graph and path list;
- API health and dataset warnings.

The browser uses relative URLs such as `/api/routes`, so UI and API run on the same origin and do not require CORS. Only the three explicit static paths `/`, `/app.js`, and `/styles.css` are served; arbitrary filesystem paths are never accepted.

## Requirements

- Bun 1.3 or newer

## Install and run

```bash
bun install
cp .env.example .env
bun run start
```

The repository already ignores the local `.env` file. Keep `.env.example` committed as the documented configuration template.

Development mode:

```bash
bun run dev
```

The frontend and API listen on `http://localhost:3000` by default. Bun loads `.env` automatically, so no `dotenv` dependency is required.

Supported environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port used by `Bun.serve` |
| `GRAPH_DATA_PATH` | `./train-ticket-be.json` | Path to the input graph dataset |

Values can be changed in the local `.env` file:

```env
PORT=4000
GRAPH_DATA_PATH=./train-ticket-be.json
```

They can also be provided for a single command:

```bash
PORT=4000 GRAPH_DATA_PATH=./train-ticket-be.json bun run start
```

## API

### Health

```http
GET /health
```

Reports the number of valid loaded nodes and edges, together with dataset warnings.

### Full graph

```http
GET /api/graph
```

Returns normalized `nodes` and `edges`. Every edge has a client-friendly shape:

```json
{
  "source": "frontend",
  "target": "admin-basic-info-service"
}
```

### Query routes

```http
GET /api/routes
```

Optional filters:

| Parameter | Route condition |
| --- | --- |
| `startsPublic` | First node has `publicExposed: true` |
| `endsInSink` | Last node has `kind: "rds"` or `kind: "sql"` |
| `hasVulnerability` | At least one route node has a non-empty `vulnerabilities` array |

Examples:

```bash
curl 'http://localhost:3000/api/routes?startsPublic=true'
curl 'http://localhost:3000/api/routes?endsInSink=true&hasVulnerability=true'
curl 'http://localhost:3000/api/routes?startsPublic=true&endsInSink=true&hasVulnerability=true'
```

The response contains both individual paths and their combined renderable subgraph:

```json
{
  "routes": [
    {
      "nodeIds": [
        "admin-user-service",
        "user-service",
        "auth-service",
        "prod-postgresdb"
      ]
    }
  ],
  "graph": {
    "nodes": [
      { "name": "admin-user-service", "kind": "service" },
      { "name": "user-service", "kind": "service" },
      { "name": "auth-service", "kind": "service" },
      { "name": "prod-postgresdb", "kind": "rds" }
    ],
    "edges": [
      { "source": "admin-user-service", "target": "user-service" },
      { "source": "user-service", "target": "auth-service" },
      { "source": "auth-service", "target": "prod-postgresdb" }
    ]
  },
  "meta": {
    "routeCount": 1,
    "filters": {
      "endsInSink": true
    },
    "truncated": false,
    "warnings": []
  }
}
```

An empty match returns `200 OK` with empty `routes`, `nodes`, and `edges`. Unknown parameters and non-boolean filter values return `400 Bad Request`.

## Safety limits

Traversal uses route-local visited-node sets and configurable `maxDepth` and `maxRoutes` limits. The defaults are the graph node count and 10,000 matching routes. Boundary filters are applied during traversal, and path predicates are applied before a route counts toward the result limit. `meta.truncated` is set when a limit prevents complete enumeration.

Route enumeration can be exponential in a branching graph because the API returns complete paths. Graph construction itself is linear in the number of nodes and normalized edges.

## Tests

```bash
bun test
bun run typecheck
bun run check
```

Tests cover normalization, invalid references, duplicates, cycles, traversal limits, each filter's semantics, AND combinations, the supplied dataset, and HTTP errors.
