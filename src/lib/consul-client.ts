const CONSUL_API_URL =
  process.env.CONSUL_API_URL ?? process.env.NEXT_PUBLIC_CONSUL_API_URL ?? "http://127.0.0.1:6767";

export async function consulFetch(path: string, init?: RequestInit) {
  const url = `${CONSUL_API_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export { CONSUL_API_URL };
