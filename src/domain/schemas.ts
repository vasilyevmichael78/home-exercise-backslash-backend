import { z } from "zod";

export const vulnerabilitySchema = z
  .object({
    file: z.string(),
    severity: z.string(),
    message: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const graphNodeSchema = z
  .object({
    name: z.string().trim().min(1),
    kind: z.string().trim().min(1),
    language: z.string().optional(),
    path: z.string().optional(),
    publicExposed: z.boolean().optional(),
    vulnerabilities: z.array(vulnerabilitySchema).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const rawEdgeSchema = z.object({
  from: z.string().trim().min(1),
  to: z.union([
    z.string().trim().min(1),
    z.array(z.string().trim().min(1)).min(1),
  ]),
});

export const graphDatasetSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(rawEdgeSchema),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type RawEdge = z.infer<typeof rawEdgeSchema>;
export type GraphDataset = z.infer<typeof graphDatasetSchema>;

