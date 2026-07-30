const REPOS_PATH = "/projects/api/repos";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === REPOS_PATH) {
      return handleRepos(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleRepos(request, env) {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env.GITHUB_TOKEN) {
    return json({ error: "GITHUB_TOKEN is not configured on this Worker" }, 500);
  }

  const ghRes = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all&affiliation=owner",
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "User-Agent": "guerrillaconcerto-dashboard",
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!ghRes.ok) {
    return json({ error: "GitHub API error", status: ghRes.status }, 502);
  }

  const repos = await ghRes.json();

  const cleaned = repos
    .filter((r) => !r.fork)
    .map((r) => ({
      name: r.name,
      description: r.description,
      url: r.homepage || r.html_url,
      github_url: r.html_url,
      private: r.private,
      language: r.language,
      updated_at: r.updated_at,
      archived: r.archived,
    }))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return json(cleaned, 200, "private, max-age=300");
}

function json(body, status = 200, cacheControl) {
  const headers = { "content-type": "application/json" };
  if (cacheControl) headers["cache-control"] = cacheControl;
  return new Response(JSON.stringify(body), { status, headers });
}
