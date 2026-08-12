import { jsonResponse } from "./response";

export type RequestHandler = (
  request: Request,
) => Response | Promise<Response>;

export class Router {
  private readonly routes = new Map<string, RequestHandler>();
  private readonly methodsByPath = new Map<string, Set<string>>();

  get(path: string, handler: RequestHandler): void {
    this.add("GET", path, handler);
  }

  private add(method: string, path: string, handler: RequestHandler): void {
    this.routes.set(`${method} ${path}`, handler);

    const methods = this.methodsByPath.get(path) ?? new Set<string>();
    methods.add(method);
    this.methodsByPath.set(path, methods);
  }

  async handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const handler = this.routes.get(`${request.method} ${pathname}`);

    if (handler !== undefined) {
      return handler(request);
    }

    const allowedMethods = this.methodsByPath.get(pathname);
    if (allowedMethods !== undefined) {
      return jsonResponse(
        { error: "Method not allowed" },
        405,
        { Allow: [...allowedMethods].join(", ") },
      );
    }

    return jsonResponse({ error: "Endpoint not found" }, 404);
  }
}

