import { createSlice } from '@reduxjs/toolkit';
import { loadPersistedAuth, persistAuth, clearPersistedAuth } from './authStorage';

const persisted = loadPersistedAuth();

const initialState = {
  user: persisted?.user ?? null, // user.outletId carries the outlet selected at login
  token: persisted?.token ?? null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: {
      reducer(state, action) {
        const { user, token } = action.payload;
        state.user = user;
        state.token = token;
      },
      prepare(payload, rememberMe) {
        persistAuth({ user: payload.user, token: payload.token }, rememberMe);
        return { payload };
      },
    },
    logout(state) {
      state.user = null;
      state.token = null;
      clearPersistedAuth();
    },
    // Refreshes role + permissions from GET /auth/me. State only — the login
    // choice of local/session storage is left untouched.
    setAccess(state, action) {
      if (state.user) Object.assign(state.user, action.payload);
    },
    setActiveOutlet(state, action) {
      if (state.user) {
        state.user.outletId = action.payload;
        persistAuth({ user: state.user, token: state.token }, true);
      }
    },
  },
});

export const {
  setCredentials, logout, setActiveOutlet, setAccess,
} = authSlice.actions;
export default authSlice.reducer;

export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => Boolean(state.auth.token);
export const selectActiveOutletId = (state) => state.auth.user?.outletId;
