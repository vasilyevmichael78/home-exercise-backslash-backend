export function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return Response.json(body, {
    status,
    ...(headers === undefined ? {} : { headers }),
  });
}
