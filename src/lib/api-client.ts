const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API_URL || "http://localhost:4500";

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiClient<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...Object.fromEntries(
      Object.entries(customHeaders || {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    ),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = path.startsWith("http") ? path : `${AUTH_API}${path}`;
  const res = await fetch(url, { ...rest, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Terjadi kesalahan" }));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return res.json();
}
