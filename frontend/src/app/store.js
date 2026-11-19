import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { baseApi } from '../api/baseApi';
import authReducer, { logout, setCredentials } from '../features/auth/authSlice';
import uiReducer from '../features/ui/uiSlice';
import tabsReducer from '../features/tabs/tabsSlice';

// Dashboard (and report) data is scoped to the signed-in user — non-admins only
// get the bills they made — so the RTK Query cache must never outlive the
// session: clear it on logout and on every fresh login, otherwise the next
// person to sign in on the same browser tab could briefly see the previous
// user's cached numbers.
const sessionCacheListener = createListenerMiddleware();
sessionCacheListener.startListening({
  matcher: isAnyOf(logout, setCredentials),
  effect: (_action, listenerApi) => {
    listenerApi.dispatch(baseApi.util.resetApiState());
  },
});

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    tabs: tabsReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(sessionCacheListener.middleware).concat(baseApi.middleware),
});
