import { describe, expect, test } from "bun:test";
import { RouteQueryService } from "../src/application/route-query.service";
import { Graph } from "../src/domain/graph";
import { discoverRoutes } from "../src/domain/route";
import { graphDatasetSchema } from "../src/domain/schemas";

function createTestGraph(): Graph {
  const dataset = graphDatasetSchema.parse({
    nodes: [
      { name: "public", kind: "service", publicExposed: true },
      {
        name: "vulnerable",
        kind: "service",
        vulnerabilities: [
          {
            file: "service.ts",
            severity: "high",
            message: "Example vulnerability",
          },
        ],
      },
      { name: "database", kind: "rds" },
      { name: "clean", kind: "service" },
      { name: "leaf", kind: "service" },
      { name: "private", kind: "service", publicExposed: false },
    ],
    edges: [
      { from: "public", to: ["vulnerable", "clean"] },
      { from: "vulnerable", to: "database" },
      { from: "clean", to: "leaf" },
      { from: "private", to: "database" },
    ],
  });

  return Graph.fromDataset(dataset);
}

describe("RouteQueryService", () => {
  test("discovers complete directed root-to-leaf routes", () => {
    const result = discoverRoutes(createTestGraph());

    expect(result.truncated).toBeFalse();
    expect(result.routes).toEqual([
      { nodeIds: ["public", "vulnerable", "database"] },
      { nodeIds: ["public", "clean", "leaf"] },
      { nodeIds: ["private", "database"] },
    ]);
  });

  test("combines enabled filters with AND semantics", () => {
    const service = new RouteQueryService(createTestGraph());

    const result = service.findRoutes({
      startsPublic: true,
      endsInSink: true,
      hasVulnerability: true,
    });

    expect(result.routes).toEqual([
      { nodeIds: ["public", "vulnerable", "database"] },
    ]);
    expect(result.meta.routeCount).toBe(1);
    expect(result.graph.edges).toEqual([
      { source: "public", target: "vulnerable" },
      { source: "vulnerable", target: "database" },
    ]);
  });

  test("supports false as an explicit inverse filter", () => {
    const service = new RouteQueryService(createTestGraph());

    const result = service.findRoutes({ startsPublic: false });

    expect(result.routes).toEqual([
      { nodeIds: ["private", "database"] },
    ]);
  });

  test("avoids revisiting a node when a graph contains a cycle", () => {
    const dataset = graphDatasetSchema.parse({
      nodes: [
        { name: "root", kind: "service" },
        { name: "a", kind: "service" },
        { name: "b", kind: "service" },
        { name: "leaf", kind: "service" },
      ],
      edges: [
        { from: "root", to: "a" },
        { from: "a", to: ["b", "leaf"] },
        { from: "b", to: "a" },
      ],
    });

    const result = discoverRoutes(Graph.fromDataset(dataset));

    expect(result.routes).toEqual([
      { nodeIds: ["root", "a", "leaf"] },
    ]);
  });

  test("reports truncation when the maximum depth is reached", () => {
    const result = discoverRoutes(createTestGraph(), { maxDepth: 2 });

    expect(result.routes).toEqual([
      { nodeIds: ["private", "database"] },
    ]);
    expect(result.truncated).toBeTrue();
  });

  test("reports route-limit truncation only when another route exists", () => {
    const exactResult = discoverRoutes(createTestGraph(), { maxRoutes: 3 });
    const limitedResult = discoverRoutes(createTestGraph(), { maxRoutes: 2 });

    expect(exactResult.routes).toHaveLength(3);
    expect(exactResult.truncated).toBeFalse();
    expect(limitedResult.routes).toHaveLength(2);
    expect(limitedResult.truncated).toBeTrue();
  });
});
