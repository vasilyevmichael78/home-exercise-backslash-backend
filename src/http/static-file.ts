const staticFiles = {
  "/": {
    path: "public/index.html",
    contentType: "text/html; charset=utf-8",
  },
  "/app.js": {
    path: "public/app.js",
    contentType: "text/javascript; charset=utf-8",
  },
  "/styles.css": {
    path: "public/styles.css",
    contentType: "text/css; charset=utf-8",
  },
  "/openapi.json": {
    path: "public/openapi.json",
    contentType: "application/json; charset=utf-8",
  },
} as const;

export type StaticRoute = keyof typeof staticFiles;

export function getStaticRoutes(): StaticRoute[] {
  return Object.keys(staticFiles) as StaticRoute[];
}

export async function serveStaticFile(route: StaticRoute): Promise<Response> {
  const asset = staticFiles[route];
  const file = Bun.file(asset.path);

  if (!(await file.exists())) {
    return Response.json({ error: "Static asset not found" }, { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "no-cache",
    },
  });
}
