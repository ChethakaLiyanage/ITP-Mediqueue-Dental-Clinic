export const API_BASE = "http://localhost:5000";

async function jsonRequest(path, options = {}) {
  const { method = "GET", body, headers = {}, ...rest } = options;
  const fetchOptions = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...rest,
  };
  if (body !== undefined) {
    fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, fetchOptions);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

export function getJSON(path, options) {
  return jsonRequest(path, { ...(options || {}), method: "GET" });
}

export function postJSON(path, body, options) {
  return jsonRequest(path, { ...(options || {}), method: "POST", body });
}

export function putJSON(path, body, options) {
  return jsonRequest(path, { ...(options || {}), method: "PUT", body });
}

export function patchJSON(path, body, options) {
  return jsonRequest(path, { ...(options || {}), method: "PATCH", body });
}

export function delJSON(path, body, options) {
  return jsonRequest(path, { ...(options || {}), method: "DELETE", body });
}
