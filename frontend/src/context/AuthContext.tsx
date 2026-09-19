import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: (credential: string, userInfo?: any) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for persisted session
    const savedUser = localStorage.getItem('reachinbox_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('reachinbox_user');
      }
    }
    setLoading(false);
  }, []);

  const loginWithGoogle = async (credential: string, userInfo?: any) => {
    try {
      const authenticatedUser = await authApi.verifyGoogle(credential, userInfo);
      setUser(authenticatedUser);
      localStorage.setItem('reachinbox_user', JSON.stringify(authenticatedUser));
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const loginAsDemo = async () => {
    try {
      const demoUser = await authApi.getMe('growth@reachinbox.ai');
      setUser(demoUser);
      localStorage.setItem('reachinbox_user', JSON.stringify(demoUser));
    } catch (error) {
      // Fallback
      const fallbackUser: User = {
        id: 'demo-user-id',
        email: 'growth@reachinbox.ai',
        name: 'ReachInbox Growth Lead',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      };
      setUser(fallbackUser);
      localStorage.setItem('reachinbox_user', JSON.stringify(fallbackUser));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('reachinbox_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        loginAsDemo,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
