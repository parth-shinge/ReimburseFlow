import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login/', { email, password });
    const { tokens, user: userData } = response.data;
    
    // Backend returns { user: {...}, tokens: { access, refresh } }
    const u = userData || { email, role: 'EMPLOYEE' }; 
    const access = tokens?.access || response.data.access;
    const refresh = tokens?.refresh || response.data.refresh;
    
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    return response.data;
  };

  const register = async (data) => {
    const response = await api.post('/auth/signup/', data);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isEmployee = user?.role === 'EMPLOYEE';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, isAdmin, isManager, isEmployee }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
