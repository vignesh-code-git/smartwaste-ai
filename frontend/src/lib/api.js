"use client";

import { useCallback, useEffect, useState } from "react";

import { API_URL } from "./detection/scan";

const BASE = `${API_URL}/smartwaste`;

// Requests against the SmartWaste API. `body` may be a plain object (sent
// as JSON) or FormData (sent as multipart, e.g. with a photo).
export async function api(path, { method = "GET", body, query } = {}) {
  const url = new URL(`${BASE}/${path.replace(/^\//, "")}`);

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const isForm = body instanceof FormData;

  let response;

  try {
    response = await fetch(url, {
      method,
      headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new Error("The SmartWaste server is unreachable. Check that the backend is running.");
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(describeError(data) || `Request failed (${response.status}).`);
  }

  return data;
}

// Loads `path` and keeps it in state. `reload` refetches; `setData`
// applies optimistic local updates.
export function useApi(path, query) {
  const key = JSON.stringify(query || {});
  const [state, setState] = useState({ data: null, error: "", loading: true, version: 0 });

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, version: previous.version + 1 }));
  }, []);

  const setData = useCallback((update) => {
    setState((previous) => ({
      ...previous,
      data: typeof update === "function" ? update(previous.data) : update,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    api(path, { query: JSON.parse(key) }).then(
      (data) => !cancelled && setState((previous) => ({ ...previous, data, error: "", loading: false })),
      (error) => !cancelled && setState((previous) => ({ ...previous, error: error.message, loading: false }))
    );

    return () => {
      cancelled = true;
    };
  }, [path, key, state.version]);

  return { ...state, reload, setData };
}

function describeError(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;

  return Object.entries(data)
    .map(([field, messages]) => `${field}: ${[].concat(messages).join(" ")}`)
    .join(" · ");
}
