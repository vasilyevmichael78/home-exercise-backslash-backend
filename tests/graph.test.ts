import { describe, expect, test } from "bun:test";
import { Graph, GraphDataError } from "../src/domain/graph";
import { graphDatasetSchema } from "../src/domain/schemas";

describe("Graph", () => {
  test("normalizes string and array targets", () => {
    const dataset = graphDatasetSchema.parse({
      nodes: [
        { name: "a", kind: "service" },
        { name: "b", kind: "service" },
        { name: "c", kind: "service" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: ["c"] },
      ],
    });

    const graph = Graph.fromDataset(dataset);

    expect(graph.edges).toEqual([
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ]);
  });

  test("skips dangling edges with a warning in lenient mode", () => {
    const dataset = graphDatasetSchema.parse({
      nodes: [{ name: "a", kind: "service" }],
      edges: [{ from: "a", to: "missing" }],
    });

    const graph = Graph.fromDataset(dataset);

    expect(graph.edges).toEqual([]);
    expect(graph.warnings).toEqual([
      "Skipped edge a -> missing: unknown node missing",
    ]);
  });

  test("rejects dangling edges in strict mode", () => {
    const dataset = graphDatasetSchema.parse({
      nodes: [{ name: "a", kind: "service" }],
      edges: [{ from: "a", to: "missing" }],
    });

    expect(() =>
      Graph.fromDataset(dataset, { strictReferences: true }),
    ).toThrow(GraphDataError);
  });

  test("rejects duplicate node names", () => {
    const dataset = graphDatasetSchema.parse({
      nodes: [
        { name: "duplicate", kind: "service" },
        { name: "duplicate", kind: "rds" },
      ],
      edges: [],
    });

    expect(() => Graph.fromDataset(dataset)).toThrow(
      "Duplicate node name: duplicate",
    );
  });
});

