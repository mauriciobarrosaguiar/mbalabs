import "server-only";

export async function googleRequest<T>(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  return readGoogleResponse<T>(response, "O Google recusou a operação solicitada.");
}

export async function readGoogleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  let payload: any = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.error_description ?? payload?.message ?? fallbackMessage;
    throw new Error(`${message} (HTTP ${response.status})`);
  }

  return payload as T;
}
