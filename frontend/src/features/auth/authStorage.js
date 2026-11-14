// Thin wrapper so "Remember me" decides whether the session survives a
// browser restart (localStorage) or just the current tab (sessionStorage).
const STORAGE_KEY = 'nexora_auth';

export function loadPersistedAuth() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore corrupted/inaccessible storage
    }
  }
  return null;
}

// True when the current session was saved with "Remember me" (localStorage).
export function isPersistentSession() {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function persistAuth(authState, rememberMe) {
  const storage = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(authState));
    other.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (e.g. private browsing) - fail silently, auth still
    // works for the current in-memory session
  }//
}

export function clearPersistedAuth() { 
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('nexora_last_activity');
    localStorage.setItem('nexora_logout_signal', Date.now().toString());
  } catch {
    // ignore
  }
}
