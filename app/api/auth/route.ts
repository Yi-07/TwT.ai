import { type NextRequest } from "next/server";

const PASSWORD = process.env.ACCESS_PASSWORD;

const COOKIE_NAME = "twt-auth";
const MAX_AGE = 86400; // 24 hours

function setAuthCookie() {
  return `${COOKIE_NAME}=1; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; HttpOnly`;
}

function clearAuthCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": setAuthCookie(),
    },
  });
}

function unauthorized() {
  return new Response(JSON.stringify({ ok: false }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearAuthCookie(),
    },
  });
}

export async function GET(request: NextRequest) {
  // No password set = always open
  if (!PASSWORD) return ok();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token === "1") return ok();
  return unauthorized();
}

export async function POST(request: NextRequest) {
  if (!PASSWORD) return ok();

  const body = await request.json().catch(() => null);
  if (body?.password === PASSWORD) return ok();
  return unauthorized();
}
