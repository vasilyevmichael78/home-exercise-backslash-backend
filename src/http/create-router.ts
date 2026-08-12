import type { RouteQueryService } from "../application/route-query.service";
import type { Graph } from "../domain/graph";
import { createGetRoutesController } from "./controllers/get-routes.controller";
import { jsonResponse } from "./response";
import { Router } from "./router";
import { getStaticRoutes, serveStaticFile } from "./static-file";

export type HttpDependencies = {
  graph: Graph;
  routeQueryService: RouteQueryService;
};

export function createRouter({
  graph,
  routeQueryService,
}: HttpDependencies): Router {
  const router = new Router();

  for (const route of getStaticRoutes()) {
    router.get(route, () => serveStaticFile(route));
  }

  router.get("/health", () =>
    jsonResponse({
      status: "ok",
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      warnings: graph.warnings,
    }),
  );

  router.get("/api/graph", () =>
    jsonResponse({
      ...graph.serialize(),
      meta: { warnings: graph.warnings },
    }),
  );

  router.get(
    "/api/routes",
    createGetRoutesController(routeQueryService),
  );

  return router;
}
