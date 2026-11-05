// Shared staff session state; run from frontend with `npm run dev`.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, getErrorMessage, getAccessToken, setAccessToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Restore the current user from the session token when the app loads.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getAccessToken()));

  useEffect(() => {
    if (!getAccessToken()) return;

    authApi
      .me()
      .then(({ data }) => setUser(data))
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    // Save the token only for this browser session.
    const { data } = await authApi.login(email, password);
    setAccessToken(data.access_token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    // Remove both local auth state and the session token.
    setAccessToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      setUser,
      getErrorMessage,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  // Fail fast when a component is rendered outside the provider.
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
