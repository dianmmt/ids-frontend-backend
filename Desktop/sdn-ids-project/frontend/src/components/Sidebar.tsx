import React, { useEffect, useState } from 'react';
import { 
  Shield, 
  Home, 
  Network, 
  AlertTriangle, 
  Activity, 
  BarChart3, 
  Settings, 
  LogOut,
  X,
  Users
} from 'lucide-react';
import { ViewType } from '../App';
import { User, authService } from '../services/authService';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  currentUser: User | null;
}

const navigationItems = [
  { id: 'dashboard', icon: Home, label: 'Dashboard', badge: null },
  { id: 'topology', icon: Network, label: 'Network Topology', badge: null },
  { id: 'attacks', icon: AlertTriangle, label: 'Attack Detection', badge: '24' },
  { id: 'analytics', icon: Activity, label: 'Flow Analysis', badge: null },
  { id: 'performance', icon: BarChart3, label: 'Perfomance', badge: null },
  { id: 'users', icon: Users, label: 'User Management', badge: null, adminOnly: true },
  { id: 'settings', icon: Settings, label: 'Settings', badge: null },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  isOpen,
  onClose,
  onLogout,
  currentUser
}) => {
  const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');

  const visibleNavItems = navigationItems.filter(item => !item.adminOnly || currentUser?.role === 'admin');

  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);

  useEffect(() => {
    let timer: any;
    const load = async () => {
      try {
        const info = await authService.getSessionInfo();
        setLastLogin(info.last_login);
        setSessionSeconds(info.session_seconds);
      } catch (e) {
        // ignore
      }
    };
    load();

    // Update session timer locally every second
    timer = setInterval(() => {
      setSessionSeconds(prev => (lastLogin && prev >= 0 ? prev + 1 : prev));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const formatSession = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-full w-80 bg-gray-900 border-r border-gray-700 flex flex-col z-30
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo & Brand */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">SDN-IDS</h1>
                <p className="text-xs text-gray-400">ML Security Platform</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {visibleNavItems.map((item) => {
              const isActive = currentView === (item.id as ViewType);
              const Icon = item.icon;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onViewChange(item.id as ViewType);
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left",
                      isActive
                        ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1 font-medium text-sm">{item.label}</span>
                    {item.badge && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-medium">
                {currentUser?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {currentUser?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-400 truncate capitalize mb-1">
                {currentUser?.role || 'User'}
              </p>
              {/* Session info - horizontal layout */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center">
                  Last: <span className="text-gray-300 ml-1">{formatTime(lastLogin)}</span>
                </span>
                <span className="flex items-center">
                  Session: <span className="text-gray-300 ml-1">{formatSession(sessionSeconds)}</span>
                </span>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors flex-shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};