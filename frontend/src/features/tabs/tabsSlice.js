import { createSlice } from '@reduxjs/toolkit';
import { HOME_TAB_PATH } from '../../components/layout/pageMeta';

// Open-tab strip (see TabBar.jsx) — tracks which page routes are "open" for
// the session, browser-tab style. Only the pathname is kept here (not
// label/icon, which aren't serializable-friendly and are cheap to
// re-derive via getPageMeta at render time).
//
// Persisted to sessionStorage (same read/write pattern uiSlice.js already
// uses for its own settings, just session- instead of local-scoped): a
// plain page refresh (F5, a crash recovery, re-opening a closed browser
// tab via "reopen closed tab") keeps the strip exactly as it was, but a
// genuinely new browser session (a fresh tab/window, not sharing this
// one's sessionStorage) still starts clean with just Home open — matching
// how a real browser's own tab strip behaves across a refresh vs. a fresh
// window.
const OPEN_TABS_STORAGE_KEY = 'nexora-open-tabs';

function readStoredOpenPaths() {
  if (typeof window === 'undefined') return [HOME_TAB_PATH];
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(OPEN_TABS_STORAGE_KEY) || 'null');
    if (!Array.isArray(stored) || stored.some((p) => typeof p !== 'string')) return [HOME_TAB_PATH];
    const deduped = [...new Set(stored)];
    return deduped.includes(HOME_TAB_PATH) ? deduped : [HOME_TAB_PATH, ...deduped];
  } catch {
    return [HOME_TAB_PATH];
  }
}

function persistOpenPaths(paths) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // Ignore write failures (e.g. private browsing storage restrictions) —
    // the strip still works for the rest of this session, it just won't
    // survive a refresh.
  }
}

const initialState = {
  openPaths: readStoredOpenPaths(),
  // Paths with real unsaved work on screen (a return/sale in progress,
  // ...) — set by whichever page is open there via the useTabDirty hook.
  // Purely in-memory: a dirty flag is about work sitting in that page's
  // live React state, which a refresh clears anyway, so there's nothing
  // meaningful to persist here across one.
  dirtyPaths: [],
};

const FALLBACK_MAX_OPEN_TABS = 10;

const tabsSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    // Tabs never auto-close: once at the cap, a new tab is simply refused
    // (see AppShell.jsx, which checks this same limit before dispatching
    // and shows the "Tab limit reached" warning instead) — the user has to
    // close one manually. `maxOpenTabs` is passed in from the caller (ui
    // slice's Settings > Tabs slider) since slices can't read each other's
    // state directly; guarded against a bad/missing value the same way a
    // caller-refused open would be, so a malformed limit can never let the
    // strip grow unbounded.
    openTab: {
      reducer(state, action) {
        const { path, maxOpenTabs } = action.payload;
        if (state.openPaths.includes(path)) return;
        const safeMax = Number.isFinite(maxOpenTabs) && maxOpenTabs >= 1 ? maxOpenTabs : FALLBACK_MAX_OPEN_TABS;
        if (state.openPaths.length >= safeMax) return;
        state.openPaths.push(path);
        persistOpenPaths(state.openPaths);
      },
      prepare(path, maxOpenTabs) {
        return { payload: { path, maxOpenTabs } };
      },
    },
    closeTab(state, action) {
      if (action.payload === HOME_TAB_PATH) return;
      state.openPaths = state.openPaths.filter((p) => p !== action.payload);
      state.dirtyPaths = state.dirtyPaths.filter((p) => p !== action.payload);
      persistOpenPaths(state.openPaths);
    },
    closeAllTabs(state) {
      state.openPaths = [HOME_TAB_PATH];
      state.dirtyPaths = [];
      persistOpenPaths(state.openPaths);
    },
    // Called by useTabDirty (see hooks/useTabDirty.js) whenever the page
    // open on a tab's own unsaved-work condition changes, so TabBar can
    // ask for confirmation before closing a tab that would lose something.
    setTabDirty(state, action) {
      const { path, dirty } = action.payload;
      const isDirty = state.dirtyPaths.includes(path);
      if (dirty && !isDirty) state.dirtyPaths.push(path);
      else if (!dirty && isDirty) state.dirtyPaths = state.dirtyPaths.filter((p) => p !== path);
    },
  },
});

export const { openTab, closeTab, closeAllTabs, setTabDirty } = tabsSlice.actions;
export default tabsSlice.reducer;

export const selectOpenTabPaths = (state) => state.tabs.openPaths;
export const selectDirtyTabPaths = (state) => state.tabs.dirtyPaths;
export const selectIsTabDirty = (path) => (state) => state.tabs.dirtyPaths.includes(path);
