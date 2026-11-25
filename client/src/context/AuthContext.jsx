import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken, getStoredTool, setStoredTool, SEED_USERS } from '../api/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTool, setActiveToolState] = useState(getStoredTool());
  const [loading, setLoading] = useState(true);

  async function checkAuth(toolToUse = activeTool) {
    const token = getStoredToken();
    if (!token) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }
    try {
      const user = await api.getMe(toolToUse);
      setCurrentUser(user);
    } catch (err) {
      setStoredToken('');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function loginWithToken(token, tool = 'api') {
    setStoredToken(token);
    setStoredTool(tool);
    setActiveToolState(tool);
    setLoading(true);
    try {
      const user = await api.getMe(tool);
      setCurrentUser(user);
      return user;
    } catch (err) {
      setStoredToken('');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function loginAsSeedUser(seedUserId, toolOverride) {
    const seed = SEED_USERS.find(u => u.userId === seedUserId);
    if (!seed) throw new Error(`Seed user ${seedUserId} not found`);
    const tool = toolOverride || seed.tool;
    return await loginWithToken(seed.token, tool);
  }

  function setActiveTool(tool) {
    setStoredTool(tool);
    setActiveToolState(tool);
  }

  function logout() {
    setStoredToken('');
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        activeTool,
        setActiveTool,
        loginWithToken,
        loginAsSeedUser,
        logout,
        refreshUser: checkAuth,
        seedUsers: SEED_USERS
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
