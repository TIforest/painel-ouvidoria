const SESSION_COOKIE = "ouvidoria_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const STATUS_VALUES = ["aberta", "andamento", "fechada"];
const PRIORIDADE_VALUES = ["alta", "media", "baixa"];

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(extraHeaders || {}) },
  });
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function getSessionId(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function createSession(env) {
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await env.DB.prepare("INSERT INTO sessions (id, expires_at) VALUES (?1, ?2)").bind(id, expiresAt).run();
  return `${SESSION_COOKIE}=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

async function verifySession(request, env) {
  const id = getSessionId(request);
  if (!id) return false;
  const row = await env.DB.prepare("SELECT expires_at FROM sessions WHERE id = ?1").bind(id).first();
  if (!row) return false;
  if (Date.now() > row.expires_at) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(id).run();
    return false;
  }
  return true;
}

async function destroySession(request, env) {
  const id = getSessionId(request);
  if (id) await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(id).run();
}

async function handleIngest(request, env) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "json invalido" }, 400, corsHeaders(env));
  }

  const required = ["protocolo", "data_envio", "tipo", "identificacao", "mensagem"];
  for (const field of required) {
    if (!data[field] || typeof data[field] !== "string") {
      return json({ error: `campo obrigatorio ausente: ${field}` }, 400, corsHeaders(env));
    }
  }

  try {
    await env.DB.prepare(
      `INSERT INTO denuncias
        (protocolo, data_envio, tipo, identificacao, nome, email, setor, mensagem, evidencias, contato_retorno, id_navegador)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
      .bind(
        data.protocolo,
        data.data_envio,
        data.tipo,
        data.identificacao,
        data.nome || null,
        data.email || null,
        data.setor || null,
        data.mensagem,
        data.evidencias || null,
        data.contato_retorno || null,
        data.id_navegador || null
      )
      .run();
  } catch (err) {
    // protocolo repetido (reenvio) nao deve travar o site publico
    if (String(err.message || "").includes("UNIQUE")) {
      return json({ ok: true }, 200, corsHeaders(env));
    }
    return json({ error: "falha ao registrar" }, 500, corsHeaders(env));
  }

  return json({ ok: true }, 200, corsHeaders(env));
}

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!safeEqual(body.senha, env.PAINEL_SENHA)) {
    return json({ error: "senha incorreta" }, 401);
  }
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(Date.now()).run();
  const cookie = await createSession(env);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
}

async function handleLogout(request, env) {
  await destroySession(request, env);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

async function handleMe(request, env) {
  return json({ authenticated: await verifySession(request, env) }, 200);
}

async function handleList(request, env) {
  if (!(await verifySession(request, env))) return json({ error: "unauthorized" }, 401);
  const { results } = await env.DB.prepare(
    `SELECT id, protocolo, data_envio, tipo, identificacao, nome, email, setor, mensagem,
            evidencias, contato_retorno, status, prioridade, notas_juridico, created_at, updated_at
     FROM denuncias
     ORDER BY created_at DESC`
  ).all();
  return json({ denuncias: results }, 200);
}

async function handleUpdate(request, env, id) {
  if (!(await verifySession(request, env))) return json({ error: "unauthorized" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "json invalido" }, 400);
  }

  const fields = [];
  const values = [];

  if (body.status !== undefined) {
    if (!STATUS_VALUES.includes(body.status)) return json({ error: "status invalido" }, 400);
    fields.push("status = ?");
    values.push(body.status);
  }

  if (body.prioridade !== undefined) {
    if (body.prioridade !== null && !PRIORIDADE_VALUES.includes(body.prioridade)) {
      return json({ error: "prioridade invalida" }, 400);
    }
    fields.push("prioridade = ?");
    values.push(body.prioridade);
  }

  if (body.notas_juridico !== undefined) {
    fields.push("notas_juridico = ?");
    values.push(String(body.notas_juridico).slice(0, 5000));
  }

  if (!fields.length) return json({ error: "nada para atualizar" }, 400);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await env.DB.prepare(`UPDATE denuncias SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return json({ ok: true }, 200);
}

const MODO_MANUTENCAO = true; // painel derrubado por incidente de seguranca em 04/09/2026 — reverter apos investigar

export default {
  async fetch(request, env) {
    if (MODO_MANUTENCAO) {
      return new Response("Serviço temporariamente indisponível.", { status: 503 });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/ingest") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(env) });
      }
      if (request.method === "POST") return handleIngest(request, env);
    }

    if (url.pathname === "/api/login" && request.method === "POST") return handleLogin(request, env);
    if (url.pathname === "/api/logout" && request.method === "POST") return handleLogout(request, env);
    if (url.pathname === "/api/me" && request.method === "GET") return handleMe(request, env);
    if (url.pathname === "/api/denuncias" && request.method === "GET") return handleList(request, env);

    const updateMatch = url.pathname.match(/^\/api\/denuncias\/(\d+)$/);
    if (updateMatch && request.method === "PATCH") {
      return handleUpdate(request, env, Number(updateMatch[1]));
    }

    return env.ASSETS.fetch(request);
  },
};
