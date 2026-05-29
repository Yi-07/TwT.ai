import { getState, setState, deleteState } from "@/lib/db";

function auth(req: Request) {
  return (
    req.headers.get("authorization") ===
    `Bearer ${process.env.ACCESS_SECRET}`
  );
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function GET(request: Request) {
  if (!auth(request)) return unauthorized();
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") || "twt-conversations";
  const state = await getState(key);
  return Response.json(state ?? {});
}

export async function POST(request: Request) {
  if (!auth(request)) return unauthorized();
  const { key, value } = await request.json();
  await setState(key ?? "twt-conversations", value);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!auth(request)) return unauthorized();
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "twt-conversations";
  await deleteState(key);
  return Response.json({ ok: true });
}
