import { RouteQueryService } from "./application/route-query.service";
import { createRouter } from "./http/create-router";
import { jsonResponse } from "./http/response";
import { loadGraphFromJson } from "./infrastructure/json-graph-loader";

export type ApplicationOptions = {
  datasetPath?: string;
  maxDepth?: number;
  maxRoutes?: number;
};

export async function createApplication(options: ApplicationOptions = {}) {
  const datasetPath = options.datasetPath ?? "train-ticket-be.json";
  const graph = await loadGraphFromJson(datasetPath);
  const routeQueryService = new RouteQueryService(graph, {
    ...(options.maxDepth === undefined ? {} : { maxDepth: options.maxDepth }),
    ...(options.maxRoutes === undefined ? {} : { maxRoutes: options.maxRoutes }),
  });
  const router = createRouter({ graph, routeQueryService });

  return {
    graph,
    routeQueryService,
    fetch: async (request: Request): Promise<Response> => {
      try {
        return await router.handle(request);
      } catch (error) {
        console.error(error);
        return jsonResponse({ error: "Internal server error" }, 500);
      }
    },
  };
}

if (import.meta.main) {
  const parsedPort = Number(Bun.env.PORT ?? 3000);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const application = await createApplication({
    datasetPath: Bun.env.GRAPH_DATA_PATH ?? "train-ticket-be.json",
  });

  const server = Bun.serve({
    port: parsedPort,
    fetch: application.fetch,
  });

  console.log(`Graph Query API is listening on ${server.url}`);

  for (const warning of application.graph.warnings) {
    console.warn(warning);
  }
}

