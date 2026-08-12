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

export const routeFilterRegistry: Record<RouteFilterName, RoutePredicate> = {
  startsPublic(route, graph) {
    const firstNodeId = route.nodeIds[0];
    return (
      firstNodeId !== undefined &&
      graph.getNode(firstNodeId)?.publicExposed === true
    );
  },

  endsInSink(route, graph) {
    const lastNodeId = route.nodeIds.at(-1);
    const kind = lastNodeId === undefined ? undefined : graph.getNode(lastNodeId)?.kind;
    const normalizedKind = kind?.toLowerCase();

    return normalizedKind === "rds" || normalizedKind === "sql";
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
