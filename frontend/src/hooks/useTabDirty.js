import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { setTabDirty } from '../features/tabs/tabsSlice';

/**
 * Lets a page report "I have unsaved work right now" to the tab strip, so
 * TabBar.jsx can confirm before closing that tab instead of silently
 * discarding it. Call it with a boolean on every render — e.g.
 * `useTabDirty(cart.length > 0)` — it only dispatches when that boolean
 * actually changes.
 *
 * `useLocation()` here reads whichever path THIS mounted instance of the
 * page is pinned to — each open tab renders its page inside its own
 * `<Routes location={{ pathname: tabPath }}>` (see
 * components/layout/KeepAliveTabContent.jsx), so this always marks the
 * right tab dirty even though every open tab's page component stays
 * mounted at once.
 *
 * Clears the flag on unmount (i.e. when the tab is actually closed, since
 * KeepAliveTabContent keeps it mounted otherwise) so a closed tab can
 * never linger in the dirty list.
 */
export function useTabDirty(isDirty) {
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();

  useEffect(() => {
    dispatch(setTabDirty({ path: pathname, dirty: Boolean(isDirty) }));
  }, [dispatch, pathname, isDirty]);

  // Separate effect, deliberately not depending on `isDirty`: this one
  // only ever needs to fire its cleanup on unmount (tab close) for this
  // instance's own fixed pathname — folding it into the effect above would
  // re-run it on every isDirty change too, immediately re-clearing what
  // that effect had just set.
  useEffect(() => () => {
    dispatch(setTabDirty({ path: pathname, dirty: false }));
  }, [dispatch, pathname]);
}
