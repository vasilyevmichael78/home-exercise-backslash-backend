import { beforeAll, describe, expect, test } from "bun:test";
import { createApplication } from "../src";

let application: Awaited<ReturnType<typeof createApplication>>;

beforeAll(async () => {
  application = await createApplication();
});

async function request(path: string, init?: RequestInit): Promise<Response> {
  return application.fetch(new Request(`http://localhost${path}`, init));
}

describe("HTTP API", () => {
  test("reports loaded graph details and data warnings", async () => {
    const response = await request("/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      nodes: 46,
      edges: 96,
    });
    expect(body.warnings).toHaveLength(2);
    expect(body.warnings[0]).toContain("assurance-service");
  });

  test("returns a client-renderable graph", async () => {
    const response = await request("/api/graph");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.nodes).toHaveLength(46);
    expect(body.edges).toHaveLength(96);
    expect(body.edges[0]).toEqual({
      source: "frontend",
      target: "admin-basic-info-service",
    });
  });

  test("filters routes from public services", async () => {
    const response = await request("/api/routes?startsPublic=true");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.routeCount).toBe(5);
    expect(
      body.routes.every(
        (route: { nodeIds: string[] }) => route.nodeIds[0] === "frontend",
      ),
    ).toBeTrue();
  });

  test("combines route filters with AND semantics", async () => {
    const response = await request(
      "/api/routes?startsPublic=true&endsInSink=true&hasVulnerability=true",
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.routes).toEqual([]);
    expect(body.graph).toEqual({ nodes: [], edges: [] });
  });

  test("rejects unknown and invalid filters", async () => {
    const unknownResponse = await request("/api/routes?unknown=true");
    const invalidResponse = await request(
      "/api/routes?startsPublic=maybe",
    );

    expect(unknownResponse.status).toBe(400);
    expect(invalidResponse.status).toBe(400);
  });

  test("returns 405 for a known path with an unsupported method", async () => {
    const response = await request("/api/routes", { method: "POST" });

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });

  test("returns 404 for an unknown endpoint", async () => {
    const response = await request("/missing");

    expect(response.status).toBe(404);
  });
});
