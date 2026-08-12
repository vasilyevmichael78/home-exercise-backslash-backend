import type { Graph, SerializableGraph } from "../domain/graph";
import {
  matchesRouteQuery,
  type RouteQuery,
} from "../domain/route-filter";
import {
  createRouteSubgraph,
  discoverRoutes,
  type Route,
  type RouteDiscoveryOptions,
} from "../domain/route";

export type RouteQueryResult = {
  routes: Route[];
  graph: SerializableGraph;
  meta: {
    routeCount: number;
    filters: RouteQuery;
    truncated: boolean;
    warnings: string[];
  };
};

export class RouteQueryService {
  private readonly allRoutes: Route[];
  private readonly truncated: boolean;

  constructor(
    private readonly graph: Graph,
    options: RouteDiscoveryOptions = {},
  ) {
    const discovery = discoverRoutes(graph, options);
    this.allRoutes = discovery.routes;
    this.truncated = discovery.truncated;
  }

  findRoutes(query: RouteQuery): RouteQueryResult {
    const routes = this.allRoutes.filter((route) =>
      matchesRouteQuery(route, this.graph, query),
    );

    return {
      routes,
      graph: createRouteSubgraph(this.graph, routes),
      meta: {
        routeCount: routes.length,
        filters: query,
        truncated: this.truncated,
        warnings: this.graph.warnings,
      },
    };
  }
}

