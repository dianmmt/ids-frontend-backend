import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { AttackDetection } from './components/AttackDetection';
import { NetworkTopology } from './components/NetworkTopology';
import { SecurityAnalytics } from './components/SecurityAnalytics';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { UserManagement } from './components/UserManagement';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { authService, User } from './services/authService';

export type ViewType = 'dashboard' | 'attacks' | 'topology' | 'analytics' | 'performance' | 'users' | 'settings';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(false);

  // Authentication functions
  const handleLogin = async (credentials: { username: string; password: string }) => {
    setAuthLoading(true);
    setAuthError('');
    
    try {
      const response = await authService.login(credentials);
      setCurrentUser(response.user || null);
      setAuthState('authenticated');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (userData: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }) => {
    setAuthLoading(true);
    setAuthError('');
    
    try {
      const response = await authService.register(userData);
      setCurrentUser(response.user || null);
      setAuthState('authenticated');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setCurrentUser(null);
      setAuthState('unauthenticated');
      setCurrentView('dashboard');
    }
  };

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const tokenValid = await authService.verifyToken();
        if (tokenValid.valid && tokenValid.user) {
          setCurrentUser(tokenValid.user);
          setAuthState('authenticated');
        } else {
          setAuthState('unauthenticated');
        }
      } catch (error) {
        setAuthState('unauthenticated');
      }
    };

    checkAuth();
  }, []);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'attacks':
        return <AttackDetection />;
      case 'analytics':
        return <SecurityAnalytics />;
      case 'topology':
        return <NetworkTopology />;
      case 'performance':
        return <PerformanceMonitor />;
      case 'users':
        return authService.isAdmin() ? <UserManagement /> : <Dashboard />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  // Show loading state
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication forms
  if (authState === 'unauthenticated') {
    return showLogin ? (
      <Login
        onLogin={handleLogin}
        onSwitchToRegister={() => setShowLogin(false)}
        loading={authLoading}
        error={authError}
      />
    ) : (
      <Register
        onRegister={handleRegister}
        onSwitchToLogin={() => setShowLogin(true)}
        loading={authLoading}
        error={authError}
      />
    );
  }

  // Show main application
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Fixed Sidebar */}
      <Sidebar 
        currentView={currentView}
        onViewChange={setCurrentView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        currentUser={currentUser}
      />
      
      {/* Fixed Header - positioned after sidebar on desktop */}
      <Header 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        currentView={currentView}
        currentUser={currentUser}
      />
      
      {/* Main Content Area */}
      <main className="lg:ml-80 pt-16 min-h-screen">
        <div className="p-6">
          {renderCurrentView()}
        </div>
      </main>
      
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default App;