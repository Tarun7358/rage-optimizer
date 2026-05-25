import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth as clientAuth } from '../config/firebase';

const AuthContext = createContext(null);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '1508122676894367926';
const REDIRECT_URI = encodeURIComponent(window.location.origin + '/auth/callback');

export const DISCORD_OAUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=identify%20guilds`;

// Bot invite — Administrator permissions (0x8)
export const BOT_INVITE_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuildId, setSelectedGuildId] = useState(null);

  const setAuthHeader = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('rage_token');
      const storedUser = localStorage.getItem('rage_user');
      const storedGuilds = localStorage.getItem('rage_guilds');

      if (storedToken && storedUser) {
        try {
          setAuthHeader(storedToken);
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          if (storedGuilds) {
            setGuilds(JSON.parse(storedGuilds));
          }
        } catch (e) {
          console.error('Failed to parse cached authentication data', e);
          logout();
        }
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  const login = () => {
    window.location.href = DISCORD_OAUTH_URL;
  };

  const mockLogin = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/discord`, { code: 'mock_developer_code' });
      const { token, firebaseToken, user, guilds } = response.data;

      localStorage.setItem('rage_token', token);
      localStorage.setItem('rage_user', JSON.stringify(user));
      localStorage.setItem('rage_guilds', JSON.stringify(guilds));

      setAuthHeader(token);

      if (firebaseToken && clientAuth) {
        try {
          await signInWithCustomToken(clientAuth, firebaseToken);
        } catch (fbErr) {
          console.warn('[Firebase Auth Warn]', fbErr.message);
        }
      }

      setUser(user);
      setGuilds(guilds);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Mock login failed', error);
      setLoading(false);
      return false;
    }
  };

  const exchangeCode = async (code) => {
    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/discord`, { code });
      const { token, firebaseToken, user, guilds } = response.data;

      localStorage.setItem('rage_token', token);
      localStorage.setItem('rage_user', JSON.stringify(user));
      localStorage.setItem('rage_guilds', JSON.stringify(guilds));

      setAuthHeader(token);

      if (firebaseToken && clientAuth) {
        try {
          await signInWithCustomToken(clientAuth, firebaseToken);
        } catch (fbErr) {
          console.warn('[Firebase Auth Warn]', fbErr.message);
        }
      }

      setUser(user);
      setGuilds(guilds);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Code exchange failed', error);
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('rage_token');
    localStorage.removeItem('rage_user');
    localStorage.removeItem('rage_guilds');
    setAuthHeader(null);
    setUser(null);
    setGuilds([]);
    setSelectedGuildId(null);
    if (clientAuth) {
      signOut(clientAuth).catch(() => {});
    }
  };

  const refreshGuilds = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/auth/guilds`);
      const { guilds } = response.data;
      localStorage.setItem('rage_guilds', JSON.stringify(guilds));
      setGuilds(guilds);
      return guilds;
    } catch (error) {
      console.error('Failed to refresh guilds', error);
      if (error.response && error.response.status === 401) {
        logout();
      }
      throw error;
    }
  };

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('rage_theme') || 'dark';
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light-blue') {
      root.classList.add('light-blue');
    } else {
      root.classList.remove('light-blue');
    }
    localStorage.setItem('rage_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light-blue' : 'dark');
  };

  const getSelectedGuild = () => {
    return guilds.find(g => g.id === selectedGuildId) || null;
  };

  return (
    <AuthContext.Provider value={{
      user,
      guilds,
      loading,
      login,
      mockLogin,
      logout,
      exchangeCode,
      refreshGuilds,
      selectedGuildId,
      setSelectedGuildId,
      selectedGuild: getSelectedGuild(),
      backendUrl: BACKEND_URL,
      theme,
      toggleTheme,
      sidebarOpen,
      setSidebarOpen
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
