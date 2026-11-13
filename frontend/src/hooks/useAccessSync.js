import { useEffect } from 'react';
import { useAppDispatch } from '../app/hooks';
import { setAccess } from '../features/auth/authSlice';
import { useGetMeQuery } from '../api/authApi';

/** Refreshes the user's role + permissions on every app load, so a role edited by an admin applies without a re-login. */
export function useAccessSync() {
  const dispatch = useAppDispatch();
  const { data } = useGetMeQuery(undefined, { refetchOnMountOrArgChange: true });

  useEffect(() => {
    if (data) dispatch(setAccess(data));
  }, [data, dispatch]);
}
