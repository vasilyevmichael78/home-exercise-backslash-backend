import type { Graph, SerializableGraph } from "./graph";

export type Route = {
  nodeIds: string[];
};

export type RouteDiscoveryOptions = {
  maxDepth?: number;
  maxRoutes?: number;
  startNodeIds?: readonly string[];
  isDestination?: (nodeId: string, path: readonly string[]) => boolean;
  matchesRoute?: (route: Route) => boolean;
};

export type RouteDiscoveryResult = {
  routes: Route[];
  truncated: boolean;
};

export function discoverRoutes(
  graph: Graph,
  options: RouteDiscoveryOptions = {},
): RouteDiscoveryResult {
  const maxDepth = options.maxDepth ?? Math.max(graph.nodes.length, 1);
  const maxRoutes = options.maxRoutes ?? 10_000;
  const startNodeIds =
    options.startNodeIds ?? graph.getRoots().map((node) => node.name);
  const isDestination =
    options.isDestination ?? ((nodeId: string) => graph.isLeaf(nodeId));
  const matchesRoute = options.matchesRoute ?? (() => true);

  if (!Number.isInteger(maxDepth) || maxDepth < 2) {
    throw new Error("maxDepth must be an integer greater than or equal to 2");
  }

  if (!Number.isInteger(maxRoutes) || maxRoutes < 1) {
    throw new Error("maxRoutes must be a positive integer");
  }

  const routes: Route[] = [];
  let truncated = false;
  let routeLimitReached = false;

  function visit(current: string, path: string[], visited: Set<string>): void {
    if (isDestination(current, path)) {
      if (path.length >= 2) {
        const route = { nodeIds: [...path] };

        if (matchesRoute(route)) {
          if (routes.length >= maxRoutes) {
            truncated = true;
            routeLimitReached = true;
            return;
          }

          routes.push(route);
        }
      }
      return;
    }

    if (path.length >= maxDepth) {
      truncated = true;
      return;
    }

    for (const target of graph.getOutgoing(current)) {
      if (visited.has(target)) {
        continue;
      }

      visited.add(target);
      path.push(target);
      visit(target, path, visited);
      path.pop();
      visited.delete(target);

      if (routeLimitReached) {
        return;
      }
    }
  }

  for (const startNodeId of startNodeIds) {
    if (graph.getNode(startNodeId) === undefined) {
      continue;
    }

    visit(startNodeId, [startNodeId], new Set([startNodeId]));

    if (routeLimitReached) {
      break;
    }
  }

  return { routes, truncated };
}

export function createRouteSubgraph(
  graph: Graph,
  routes: readonly Route[],
): SerializableGraph {
  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();

  for (const route of routes) {
    for (const nodeId of route.nodeIds) {
      nodeIds.add(nodeId);
    }

    for (let index = 0; index < route.nodeIds.length - 1; index += 1) {
      const source = route.nodeIds[index];
      const target = route.nodeIds[index + 1];

      if (source !== undefined && target !== undefined) {
        edgeKeys.add(`${source}\u0000${target}`);
      }
    }
  }

  return {
    nodes: graph.nodes.filter((node) => nodeIds.has(node.name)),
    edges: graph.edges.filter((edge) =>
      edgeKeys.has(`${edge.source}\u0000${edge.target}`),
    ),
  };
}
