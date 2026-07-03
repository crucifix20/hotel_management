import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "./config.js";

const LEGACY_HOTEL_NAME = "The Journey Suite";
const LEGACY_HOTEL_ADDRESS = "1 The Journey Suite Avenue, Makati Business District";

export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

export function render(target, markup) {
  target.innerHTML = markup;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function toIsoDate(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toISOString().slice(0, 10);
}

export function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthStartIso(date = new Date()) {
  const value = new Date(date);
  value.setDate(1);
  return toIsoDate(value);
}

export function monthEndIso(date = new Date()) {
  const value = new Date(date);
  value.setMonth(value.getMonth() + 1, 0);
  return toIsoDate(value);
}

export function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function differenceInNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

export function serializeForm(form) {
  const entries = new FormData(form).entries();
  return Object.fromEntries(entries);
}

export function parseNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function createOptionList(items, valueKey = "id", labelKey = "name", placeholder = "Select") {
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`];
  for (const item of items) {
    options.push(`<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey])}</option>`);
  }
  return options.join("");
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function initials(value) {
  const parts = String(value || "GMH")
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

export function getStoredSettings() {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_SETTINGS, ...parsed };

    if (!parsed.hotelName || parsed.hotelName === LEGACY_HOTEL_NAME) {
      merged.hotelName = DEFAULT_SETTINGS.hotelName;
    }

    if (!parsed.address || parsed.address === LEGACY_HOTEL_ADDRESS) {
      merged.address = DEFAULT_SETTINGS.address;
    }

    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveStoredSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

export function debounce(callback, wait = 300) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}

export function friendlyError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) {
    return fallback;
  }

  const message = error.message || error.error_description || error.msg || error.details;
  if (message && message !== "{}") {
    return message;
  }

  if (typeof error === "string" && error !== "{}") {
    return error;
  }

  return fallback;
}

export async function withFormBusy(form, pendingLabel, callback) {
  if (form.dataset.submitting === "true") {
    return;
  }

  const submitButtons = [...form.querySelectorAll('button[type="submit"], input[type="submit"]')];
  const originalLabels = submitButtons.map((button) => button.textContent);

  form.dataset.submitting = "true";
  submitButtons.forEach((button, index) => {
    button.disabled = true;
    if (index === 0 && pendingLabel) {
      button.textContent = pendingLabel;
    }
  });

  try {
    return await callback();
  } finally {
    if (document.body.contains(form)) {
      submitButtons.forEach((button, index) => {
        button.disabled = false;
        if (originalLabels[index]) {
          button.textContent = originalLabels[index];
        }
      });
    }
    delete form.dataset.submitting;
  }
}

export function buildSelectOptions(values, placeholder = "All") {
  return [`<option value="">${escapeHtml(placeholder)}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function sum(values) {
  return safeArray(values).reduce((total, value) => total + Number(value || 0), 0);
}
