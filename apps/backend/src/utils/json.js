export function safeJsonParse(maybe) { try { return JSON.parse(maybe); } catch { return null; } }
