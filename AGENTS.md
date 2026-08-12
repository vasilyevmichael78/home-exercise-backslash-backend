# Project guidance

- Communicate with the user in Russian unless they explicitly request another language.
- Use Bun as the runtime, `Bun.serve` for HTTP, Zod for runtime validation, and `bun:test` for tests.
- Keep graph traversal and filtering independent from HTTP and filesystem code.
- Treat a route as a complete directed root-to-leaf path containing at least one edge.
- Combine provided route filters with AND semantics.
- Treat nodes with `kind` equal to `rds` or `sql` as sinks for the sink filter.
- Do not silently change the supplied `train-ticket-be.json` dataset.
- Skip dangling edges in lenient loading mode and expose a warning; support strict validation in domain code.
- Add new filters through the filter registry rather than conditional logic in controllers.
- Run `bun run check` before handing off changes.

