# Backslash Graph Query API

A small read-only REST API that loads the supplied Train Ticket service graph and returns complete directed routes matching optional filters. The implementation uses pure Bun HTTP APIs, Zod validation, and `bun:test`.

## Decisions and assumptions

The assignment does not define the exact meaning of a route, so this solution uses the following explicit rules:

- A route is a complete directed path from a root node (no incoming edges) to a leaf node (no outgoing edges).
- A route contains at least one edge. An isolated node is not a route.
- A node is not visited twice within one route, so cyclic input cannot cause infinite traversal.
- Provided filters are combined with AND semantics.
- A sink for `endsInSink` is a node whose `kind` is `rds` or `sql` (case-insensitive), rather than any leaf node.
- `true` selects routes that satisfy a condition; `false` explicitly selects routes that do not satisfy it; an omitted filter is ignored.
- The graph is loaded once at startup. Dataset changes require an application restart.

The supplied dataset contains two edges to a missing `assurance-service` node. The default lenient loader skips those edges and exposes warnings through API metadata and `/health`. Domain code also supports strict reference validation.

## Architecture

```text
HTTP request
    -> pure Bun Router
    -> Controller (HTTP validation)
    -> RouteQueryService
    -> graph traversal + filter registry
    -> in-memory Graph loaded from JSON
```

HTTP, filesystem loading, graph traversal, and route filters are separate. A new route filter is added to `src/domain/route-filter.ts`; controllers and traversal do not need to change.

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

The server listens on `http://localhost:3000` by default. Bun loads `.env` automatically, so no `dotenv` dependency is required.

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

Traversal uses route-local visited-node sets and configurable `maxDepth` and `maxRoutes` limits. The defaults are the graph node count and 10,000 routes. `meta.truncated` is set when a limit prevents complete enumeration.

Route enumeration can be exponential in a branching graph because the API returns complete paths. Graph construction itself is linear in the number of nodes and normalized edges.

## Tests

```bash
bun test
bun run typecheck
bun run check
```

Tests cover normalization, invalid references, duplicates, cycles, traversal limits, each filter's semantics, AND combinations, the supplied dataset, and HTTP errors.
