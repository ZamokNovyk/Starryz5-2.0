import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  AuthUser, 
  loginWithGoogle, 
  loginAnonymously, 
  logout, 
  linkAnonymousWithGoogle,
  onAuthStateChanged,
  getStoredUser,
  refreshAuthUser
} from '@/src/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAnonymous: boolean;
  loginWithGoogle: () => Promise<AuthUser>;
  loginAnonymously: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  linkWithGoogle: () => Promise<AuthUser>;
  refreshUserProfile: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicializa inmediatamente con el usuario almacenado para evitar parpadeos
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((authUser: AuthUser | null) => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginWithGoogle = async () => {
    setLoading(true);
    try {
      const loggedUser = await loginWithGoogle();
      setUser(loggedUser);
      return loggedUser;
    } finally {
      setLoading(false);
    }
  };

  const handleLoginAnonymously = async () => {
    setLoading(true);
    try {
      const anonUser = await loginAnonymously();
      setUser(anonUser);
      return anonUser;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkWithGoogle = async () => {
    setLoading(true);
    try {
      const linkedUser = await linkAnonymousWithGoogle();
      setUser(linkedUser);
      return linkedUser;
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshUserProfile = async () => {
    try {
      const refreshed = await refreshAuthUser();
      if (refreshed) {
        setUser(refreshed);
      }
      return refreshed;
    } catch (e) {
      return user;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAnonymous: user?.isAnonymous || false,
        loginWithGoogle: handleLoginWithGoogle,
        loginAnonymously: handleLoginAnonymously,
        logout: handleLogout,
        linkWithGoogle: handleLinkWithGoogle,
        refreshUserProfile: handleRefreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
