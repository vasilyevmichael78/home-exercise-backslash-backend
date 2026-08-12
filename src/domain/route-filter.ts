import type { Graph } from "./graph";
import type { Route } from "./route";

export const routeFilterNames = [
  "startsPublic",
  "endsInSink",
  "hasVulnerability",
] as const;

export type RouteFilterName = (typeof routeFilterNames)[number];
export type RouteQuery = Partial<Record<RouteFilterName, boolean | undefined>>;
export type RoutePredicate = (route: Route, graph: Graph) => boolean;

export function isPublicNode(nodeId: string, graph: Graph): boolean {
  return graph.getNode(nodeId)?.publicExposed === true;
}

export function isSinkNode(nodeId: string, graph: Graph): boolean {
  const normalizedKind = graph.getNode(nodeId)?.kind.toLowerCase();
  return normalizedKind === "rds" || normalizedKind === "sql";
}

export const routeFilterRegistry: Record<RouteFilterName, RoutePredicate> = {
  startsPublic(route, graph) {
    const firstNodeId = route.nodeIds[0];
    return firstNodeId !== undefined && isPublicNode(firstNodeId, graph);
  },

  endsInSink(route, graph) {
    const lastNodeId = route.nodeIds.at(-1);
    return lastNodeId !== undefined && isSinkNode(lastNodeId, graph);
  },

  hasVulnerability(route, graph) {
    return route.nodeIds.some((nodeId) => {
      const vulnerabilities = graph.getNode(nodeId)?.vulnerabilities;
      return vulnerabilities !== undefined && vulnerabilities.length > 0;
    });
  },
};

export function matchesRouteQuery(
  route: Route,
  graph: Graph,
  query: RouteQuery,
): boolean {
  return routeFilterNames.every((filterName) => {
    const expected = query[filterName];

    if (expected === undefined) {
      return true;
    }

    return routeFilterRegistry[filterName](route, graph) === expected;
  });
}
