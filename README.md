# Backslash Graph Query API

A read-only REST API that loads a service graph and returns complete directed routes matching optional filters. It uses pure Bun HTTP APIs, TypeScript, Zod validation, and `bun:test`.

The repository also includes an optional dependency-free browser UI to demonstrate that the API response can be rendered directly as a graph.

## Quick start

Requirements: Bun 1.3 or newer.

```bash
bun install
cp .env.example .env
bun run start
```

Open:

- UI: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- OpenAPI 3.1: `http://localhost:3000/openapi.json`

Development mode with automatic restart:

```bash
bun run dev
```

## Run with Docker

Docker can be used when Bun is not installed on the host:

```bash
docker build -t backslash-graph-api .
docker run --rm -p 3000:3000 backslash-graph-api
```

The two-stage Dockerfile runs type checking and tests during the build, then creates a smaller runtime image that runs as the non-root `bun` user.

## API

### Query routes

```http
GET /api/routes
```

Optional filters:

| Parameter | Route condition |
| --- | --- |
| `startsPublic` | The first node has `publicExposed: true` |
| `endsInSink` | The last node has `kind: "rds"` or `kind: "sql"` |
| `hasVulnerability` | At least one route node has a non-empty `vulnerabilities` array |

All provided filters are combined with AND semantics. An omitted filter is ignored; `false` explicitly selects routes that do not satisfy that condition.

Examples:

```bash
curl 'http://localhost:3000/api/routes?startsPublic=true'
curl 'http://localhost:3000/api/routes?endsInSink=true&hasVulnerability=true'
curl 'http://localhost:3000/api/routes?startsPublic=true&endsInSink=true&hasVulnerability=true'
```

The response contains individual paths and their combined client-renderable subgraph. This is a simplified response-shape example; counts and warnings depend on the loaded dataset and selected filters.

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

An empty match returns `200 OK` with empty `routes`, `nodes`, and `edges`. Unknown parameters and invalid boolean values return `400 Bad Request`.

### Full graph

```http
GET /api/graph
```

Returns all validated nodes and normalized edges. Each edge has a frontend-friendly shape:

```json
{
  "source": "frontend",
  "target": "admin-basic-info-service"
}
```

### Health

```http
GET /health
```

Reports the number of loaded nodes and valid normalized edges, together with dataset warnings.

The complete dependency-free API contract is available at `/openapi.json` and can be imported into Postman, Insomnia, or an external Swagger UI.

## Input dataset

The query engine is not tied to the Train Ticket dataset. It accepts a compatible JSON file containing `nodes` and `edges`:

```json
{
  "nodes": [
    {
      "name": "public-api",
      "kind": "service",
      "publicExposed": true
    },
    {
      "name": "database",
      "kind": "rds"
    }
  ],
  "edges": [
    {
      "from": "public-api",
      "to": "database"
    }
  ]
}
```

`edge.to` may be either a node name or an array of node names. Node names must be unique. Unknown node references are skipped in the default lenient mode and reported as warnings; domain code also supports strict reference validation.

Load another dataset at startup:

```bash
GRAPH_DATA_PATH=./another-graph.json bun run start
```

Or mount it into the Docker container without rebuilding the image:

```bash
docker run --rm \
  -p 3000:3000 \
  -v "$PWD/another-graph.json:/data/graph.json:ro" \
  -e GRAPH_DATA_PATH=/data/graph.json \
  backslash-graph-api
```

The graph is loaded once at startup, and one process works with one graph. Runtime uploads, persistence, graph IDs, and simultaneous multi-graph queries are outside the assignment scope.

## Decisions and assumptions

The assignment does not define the exact meaning of a route, so this implementation uses the following explicit rules:

- A route is a directed simple path containing at least one edge.
- Without boundary filters, traversal runs from a root node to a leaf node.
- With `startsPublic=true`, traversal starts at every public node, even when it has incoming edges.
- With `endsInSink=true`, traversal stops at an `rds` or `sql` node, even when it has outgoing edges.
- A node is not visited twice within one route, preventing infinite traversal in cyclic graphs.
- A sink means `kind: "rds"` or `kind: "sql"`, not every node without outgoing edges.
- Results may be intentionally incomplete for excessively deep or highly branching graphs; this is reported through `meta.truncated: true`.

The supplied dataset contains two edges that reference a missing `assurance-service` node. The lenient loader skips those edges and exposes both warnings through `/health` and response metadata.

The optional static frontend is included only to demonstrate the renderable graph response. It has no framework or additional runtime dependency and remains isolated from the query engine.

## Architecture

```text
HTTP request
    -> pure Bun router
    -> API controller
    -> RouteQueryService
    -> DFS traversal + filter registry
    -> in-memory Graph loaded from JSON
```

HTTP handling, filesystem loading, graph traversal, and filter predicates are separate. A new route predicate is added through the filter registry rather than controller conditionals.

DFS was selected because the API enumerates complete paths rather than searching for only the shortest path. Traversal uses route-local visited sets and internal safety limits:

- `maxDepth`: the number of graph nodes by default;
- `maxRoutes`: 10,000 matching routes by default.

Path predicates are applied before a route counts toward `maxRoutes`. Route enumeration can still be exponential in a branching graph because the API returns complete paths.

## Configuration

Bun loads `.env` automatically; no `dotenv` dependency is required.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port used by `Bun.serve` |
| `GRAPH_DATA_PATH` | `./train-ticket-be.json` | Path to the input graph dataset |

The local `.env` file is ignored by Git, while `.env.example` documents the supported variables.

## Tests

```bash
bun run check
```

This runs TypeScript type checking and 22 tests covering normalization, invalid references, duplicate nodes, cycles, traversal limits, query-aware boundaries, filter combinations, HTTP contracts, and static assets.
