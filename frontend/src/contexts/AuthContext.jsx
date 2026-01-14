import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../features/api/index.api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  const hasToken = !!localStorage.getItem('access_token');

  const { data: userData, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await api.getMeData();
      return response.data;
    },
    enabled: hasToken,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (userData) {
      if (typeof userData === 'object' && userData !== null) {
        setUser(userData);
        setIsAuthenticated(true);
      }
    } else if (error) {
      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } else if (!hasToken) {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, [userData, error, hasToken]);

  const login = (accessToken, refreshToken, userData = null) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setIsAuthenticated(true);
    if (userData) {
      setUser(userData);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setIsAuthenticated(false);
    setUser(null);
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.removeQueries({ queryKey: ['me'] });
  };

  const value = {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
