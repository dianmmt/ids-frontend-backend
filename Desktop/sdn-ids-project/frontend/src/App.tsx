import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import AttackDetection from './components/AttackDetection';
import { NetworkTopology } from './components/NetworkTopology';
import { SecurityAnalytics } from './components/SecurityAnalytics';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { UserManagement } from './components/UserManagement';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { authService, User } from './services/authService';
import { NotificationItem } from './types/notifications';

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
  const [attackCount, setAttackCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Track notifications already surfaced to avoid duplicates across polls/streams
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());

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

  const handleAttackCountUpdate = (count: number) => {
    setAttackCount(count);
  };

  // Notifications handling
  const addNotification = useCallback((n: NotificationItem) => {
    console.log('[App] addNotification called with:', n);
    setNotifications(prev => {
      const updated = [n, ...prev];
      console.log('[App] Updated notifications state, total count:', updated.length);
      return updated;
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const acknowledgeAllNotifications = useCallback(() => {
    setNotifications([]);
    console.log('All notifications acknowledged');
  }, []);

  const navigateTo = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, []);

  // Utility to add only unseen notifications
  const addIfUnseen = useCallback((n: NotificationItem) => {
    const seen = seenNotificationIdsRef.current;
    if (seen.has(n.id)) {
      console.log('[App] Notification already seen:', n.id);
      return;
    }
    console.log('[App] Adding new notification to state:', n.id);
    seen.add(n.id);
    addNotification(n);
  }, [addNotification]);

  // Subscribe to attack SSE and convert to attack notifications
  useEffect(() => {
    // Only when authenticated
    if (authState !== 'authenticated') return;

    console.log('[App] Initializing SSE connection to /api/attacks/stream');
    const es = new EventSource('/api/attacks/stream', { withCredentials: true });

    es.onopen = () => {
      console.log('[App] SSE connection established successfully');
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[App] SSE Event received:', data);
        
        // Ignore non-attack payloads like connection/heartbeat
        if (data && data.attack_type && data.timestamp && data.id) {
          console.log('[App] Creating notification for attack:', data.attack_type);
          const title = `${data.attack_type} detected`;
          const message = `${data.source_ip || 'unknown'} → ${data.destination_ip || 'unknown'}${data.severity ? ` • ${String(data.severity).toUpperCase()}` : ''}`;
          const notification: NotificationItem = {
            id: `attack_${data.id}`,
            type: 'attack',
            title,
            message,
            severity: data.severity || 'medium',
            timestamp: data.timestamp
          };
          console.log('[App] Adding notification:', notification);
          addIfUnseen(notification);
        } else {
          console.log('[App] Ignoring event (missing required fields):', {
            hasAttackType: !!data?.attack_type,
            hasTimestamp: !!data?.timestamp,
            hasId: !!data?.id
          });
        }
      } catch (e) {
        console.error('[App] Error parsing SSE event:', e, 'Raw event:', event.data);
      }
    };

    es.onerror = (error) => {
      console.error('[App] SSE connection error:', error);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [authState, addIfUnseen]);

  // Poll performance alerts periodically and surface as notifications
  useEffect(() => {
    if (authState !== 'authenticated') return;

    let cancelled = false;

    const fetchAlerts = async () => {
      try {
        const resp = await fetch('/api/performance/realtime?refresh=true&limit=5&offset=0', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!resp.ok) return;
        const json = await resp.json();
        const alerts = Array.isArray(json.alerts) ? json.alerts : [];
        if (cancelled) return;

        alerts.forEach((a: any) => {
          const id = a.id || a.alert_id || `${a.component || 'perf'}_${a.timestamp || Date.now()}`;
          // Only notify unresolved alerts
          if (a.resolved) return;
          const notification: NotificationItem = {
            id: `perf_${id}`,
            type: 'performance',
            title: `${String(a.component || 'System')} performance alert`,
            message: `${a.message || 'Performance issue detected'}${a.severity ? ` • ${String(a.severity).toUpperCase()}` : ''}`,
            severity: (a.severity as any) || 'medium',
            timestamp: a.timestamp || new Date().toISOString()
          };
          addIfUnseen(notification);
        });
      } catch (_) {
        // ignore network errors for notifications
      }
    };

    // Initial fetch + interval
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [authState, addIfUnseen]);

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
        return <AttackDetection onAttackCountUpdate={handleAttackCountUpdate} />;
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
        attackCount={attackCount}
      />
      
      {/* Fixed Header - positioned after sidebar on desktop */}
      <Header 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        currentView={currentView}
        currentUser={currentUser}
        notifications={notifications}
        onDismissNotification={dismissNotification}
        onAcknowledgeAll={acknowledgeAllNotifications}
        onNavigate={navigateTo}
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