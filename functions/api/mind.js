export async function onRequestPost(context) {
  const { request, env } = context;

  const body = await request.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return new Response(JSON.stringify({ error: 'Empty body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await env.MIND_BUCKET.put(id, body, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });

  return new Response(JSON.stringify({ id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
