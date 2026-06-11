export function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function nullableTextValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

export function numberValue(formData: FormData, key: string, fallback = 0) {
  const raw = textValue(formData, key).replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "true" || formData.get(key) === "on";
}

export function dateValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

export function messageParam(message: string) {
  return encodeURIComponent(message);
}

export function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function includesSearch(row: Record<string, unknown>, keys: string[], search: string) {
  const term = search.trim().toLowerCase();

  if (!term) {
    return true;
  }

  return keys.some((key) => String(row[key] ?? "").toLowerCase().includes(term));
}
