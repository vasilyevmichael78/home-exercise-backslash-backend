import { z } from "zod";
import type { RouteQueryService } from "../../application/route-query.service";
import { jsonResponse } from "../response";

const booleanQueryParameter = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const routeQuerySchema = z
  .object({
    startsPublic: booleanQueryParameter.optional(),
    endsInSink: booleanQueryParameter.optional(),
    hasVulnerability: booleanQueryParameter.optional(),
  })
  .strict();

export function createGetRoutesController(
  routeQueryService: RouteQueryService,
) {
  return (request: Request): Response => {
    const { searchParams } = new URL(request.url);
    const rawQuery = Object.fromEntries(searchParams.entries());
    const parsed = routeQuerySchema.safeParse(rawQuery);

    if (!parsed.success) {
      return jsonResponse(
        {
          error: "Invalid route filters",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }

    return jsonResponse(routeQueryService.findRoutes(parsed.data));
  };
}

