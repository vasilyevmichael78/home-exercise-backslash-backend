import type { GraphDataset, GraphNode } from "./schemas";

export type GraphEdge = {
  source: string;
  target: string;
};

export type SerializableGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphBuildOptions = {
  strictReferences?: boolean;
};

export class GraphDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphDataError";
  }
}

export class Graph {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
  readonly warnings: string[];

  private readonly nodesByName: Map<string, GraphNode>;
  private readonly adjacency: Map<string, string[]>;
  private readonly incomingCounts: Map<string, number>;

  private constructor(
    nodes: GraphNode[],
    edges: GraphEdge[],
    warnings: string[],
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.warnings = warnings;
    this.nodesByName = new Map(nodes.map((node) => [node.name, node]));
    this.adjacency = new Map(nodes.map((node) => [node.name, []]));
    this.incomingCounts = new Map(nodes.map((node) => [node.name, 0]));

    for (const edge of edges) {
      this.adjacency.get(edge.source)?.push(edge.target);
      this.incomingCounts.set(
        edge.target,
        (this.incomingCounts.get(edge.target) ?? 0) + 1,
      );
    }
  }

  static fromDataset(
    dataset: GraphDataset,
    options: GraphBuildOptions = {},
  ): Graph {
    const nodesByName = new Map<string, GraphNode>();

    for (const node of dataset.nodes) {
      if (nodesByName.has(node.name)) {
        throw new GraphDataError(`Duplicate node name: ${node.name}`);
      }

      nodesByName.set(node.name, node);
    }

    const warnings: string[] = [];
    const edges: GraphEdge[] = [];
    const edgeKeys = new Set<string>();

    for (const rawEdge of dataset.edges) {
      const targets = Array.isArray(rawEdge.to) ? rawEdge.to : [rawEdge.to];

      for (const target of targets) {
        const missingNames = [rawEdge.from, target].filter(
          (name) => !nodesByName.has(name),
        );

        if (missingNames.length > 0) {
          const warning = `Skipped edge ${rawEdge.from} -> ${target}: unknown node ${missingNames.join(
            ", ",
          )}`;

          if (options.strictReferences === true) {
            throw new GraphDataError(warning);
          }

          warnings.push(warning);
          continue;
        }

        const edgeKey = `${rawEdge.from}\u0000${target}`;
        if (edgeKeys.has(edgeKey)) {
          warnings.push(`Skipped duplicate edge ${rawEdge.from} -> ${target}`);
          continue;
        }

        edgeKeys.add(edgeKey);
        edges.push({ source: rawEdge.from, target });
      }
    }

    return new Graph([...nodesByName.values()], edges, warnings);
  }

  getNode(name: string): GraphNode | undefined {
    return this.nodesByName.get(name);
  }

  getOutgoing(name: string): readonly string[] {
    return this.adjacency.get(name) ?? [];
  }

  getRoots(): GraphNode[] {
    return this.nodes.filter(
      (node) => (this.incomingCounts.get(node.name) ?? 0) === 0,
    );
  }

  isLeaf(name: string): boolean {
    return this.getOutgoing(name).length === 0;
  }

  serialize(): SerializableGraph {
    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }
}

