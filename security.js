// security.js — input validation + safe rendering helpers

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"']/g, ch => HTML_ESCAPE_MAP[ch]);
}

export function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function normalizeStudentName(value = '') {
  return normalizeWhitespace(value).slice(0, 60);
}

export function normalizeClassName(value = '') {
  return normalizeWhitespace(value).slice(0, 30);
}

export function isValidStudentName(value = '') {
  const cleaned = normalizeStudentName(value);
  return /^[A-Za-z0-9 .,'-]{2,60}$/.test(cleaned);
}

export function isValidClassName(value = '') {
  const cleaned = normalizeClassName(value);
  return /^[A-Za-z0-9 _-]{1,30}$/.test(cleaned);
}

export function setNodeText(node, value = '') {
  if (!node) return;
  node.textContent = String(value);
}

export function setElementTextById(id, value = '') {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

export function buildBadgeHtml(text, color) {
  const safeText = escapeHtml(text);
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(String(color)) ? color : '#888888';
  return `<span style="background:${safeColor}22;color:${safeColor};padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid ${safeColor}55;">${safeText}</span>`;
}

export function safeWindowTitle(value = '', fallback = 'Report') {
  return normalizeWhitespace(value) || fallback;
}