import type { Graph, SerializableGraph } from "../domain/graph";
import {
  isPublicNode,
  isSinkNode,
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

export type RouteQueryServiceOptions = Pick<
  RouteDiscoveryOptions,
  "maxDepth" | "maxRoutes"
>;

export class RouteQueryService {
  constructor(
    private readonly graph: Graph,
    private readonly options: RouteQueryServiceOptions = {},
  ) {}

  findRoutes(query: RouteQuery): RouteQueryResult {
    const startNodeIds =
      query.startsPublic === true
        ? this.graph.nodes
            .filter((node) => isPublicNode(node.name, this.graph))
            .map((node) => node.name)
        : this.graph.getRoots().map((node) => node.name);
    const isDestination =
      query.endsInSink === true
        ? (nodeId: string) => isSinkNode(nodeId, this.graph)
        : (nodeId: string) => this.graph.isLeaf(nodeId);
    const discovery = discoverRoutes(this.graph, {
      ...this.options,
      startNodeIds,
      isDestination,
      matchesRoute: (route) =>
        matchesRouteQuery(route, this.graph, query),
    });
    const routes = discovery.routes;

    return {
      routes,
      graph: createRouteSubgraph(this.graph, routes),
      meta: {
        routeCount: routes.length,
        filters: query,
        truncated: discovery.truncated,
        warnings: this.graph.warnings,
      },
    };
  }
}
