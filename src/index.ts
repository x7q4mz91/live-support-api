interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  DISCORD_WEBHOOK_URL: string;
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  return new Response(response.body, { status: response.status, headers });
}

function validVisitorId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}

async function postToDiscord(env: Env, content: string): Promise<string> {
  const response = await fetch(`${env.DISCORD_WEBHOOK_URL}?wait=true`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content,
      username: "Website support",
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook returned ${response.status}`);
  }

  const message = (await response.json()) as { id?: string };
  if (!message.id) {
    throw new Error("Discord webhook did not return a message id");
  }
  return message.id;
}

async function createVisitorMessage(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    visitorId?: unknown;
    content?: unknown;
  } | null;

  if (!body || !validVisitorId(body.visitorId) || typeof body.content !== "string") {
    return json({ error: "A valid visitorId and message are required." }, 400);
  }

  const content = body.content.trim();
  if (!content || content.length > 2000) {
    return json({ error: "Messages must contain 1 to 2000 characters." }, 400);
  }

  const insert = await env.DB.prepare(
    "INSERT INTO messages (visitor_id, role, content) VALUES (?, 'visitor', ?)",
  )
    .bind(body.visitorId, content)
    .run();
  const messageId = Number(insert.meta.last_row_id);

  try {
    const discordId = await postToDiscord(
      env,
      `**New website support message**\nTicket: \`${body.visitorId}\`\nMessage ID: \`${messageId}\`\n\n${content}`,
    );
    await env.DB.prepare("UPDATE messages SET discord_message_id = ? WHERE id = ?")
      .bind(discordId, messageId)
      .run();
  } catch (error) {
    console.error(error);
    return json({ error: "The support service is temporarily unavailable." }, 502);
  }

  return json({ ok: true, id: messageId });
}

async function getVisitorMessages(url: URL, env: Env): Promise<Response> {
  const visitorId = url.searchParams.get("visitor");
  if (!validVisitorId(visitorId)) {
    return json({ error: "A valid visitor id is required." }, 400);
  }

  const result = await env.DB.prepare(
    "SELECT id, role, content, created_at AS createdAt FROM messages WHERE visitor_id = ? ORDER BY id ASC LIMIT 200",
  )
    .bind(visitorId)
    .all();
  return json({ messages: result.results });
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  const url = new URL(request.url);

  try {
    if (url.pathname === "/api/messages" && request.method === "GET") {
      return cors(await getVisitorMessages(url, env));
    }
    if (url.pathname === "/api/messages" && request.method === "POST") {
      return cors(await createVisitorMessage(request, env));
    }
    return env.ASSETS.fetch(request);
  } catch (error) {
    console.error(error);
    return cors(json({ error: "Unexpected server error." }, 500));
  }
}

export default {
  fetch: handleRequest,
};
