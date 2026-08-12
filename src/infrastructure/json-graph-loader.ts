import { Graph, type GraphBuildOptions, GraphDataError } from "../domain/graph";
import { graphDatasetSchema } from "../domain/schemas";

export async function loadGraphFromJson(
  path: string,
  options: GraphBuildOptions = {},
): Promise<Graph> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new GraphDataError(`Graph dataset not found: ${path}`);
  }

  let rawData: unknown;

  try {
    rawData = await file.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown JSON error";
    throw new GraphDataError(`Cannot parse graph dataset: ${reason}`);
  }

  const parsed = graphDatasetSchema.safeParse(rawData);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new GraphDataError(`Invalid graph dataset: ${issues}`);
  }

  return Graph.fromDataset(parsed.data, options);
}

