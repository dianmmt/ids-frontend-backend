import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Bell, Wifi, Brain, Server, AlertTriangle, Activity, X } from 'lucide-react';
import { ViewType } from '../App';
import { User } from '../services/authService';
import { NotificationItem } from '../types/notifications';

interface HeaderProps {
  onMenuClick: () => void;
  currentView: ViewType;
  currentUser: User | null;
  notifications?: NotificationItem[];
  onDismissNotification?: (id: string) => void;
  onAcknowledgeAll?: () => void;
  onNavigate?: (view: ViewType) => void;
}

const viewTitles = {
  dashboard: 'Dashboard',
  attacks: 'Attack Detection',
  topology: 'Network Topology',
  analytics: 'Security Analytics',
  performance: 'Performance Monitor',
  users: 'User Management',
  settings: 'Settings'
};

const viewSubtitles = {
  dashboard: 'Real-time system overview',
  attacks: 'ML-powered threat detection',
  topology: 'Network visualization & analysis',
  analytics: 'Advanced security insights',
  performance: 'System performance metrics',
  users: 'Access control & user roles',
  settings: 'System configuration & preferences'
};

export const Header: React.FC<HeaderProps> = ({ onMenuClick, currentView, currentUser, notifications = [], onDismissNotification, onAcknowledgeAll, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sections = useMemo(() => {
    return {
      attacks: notifications.filter(n => n.type === 'attack'),
      performance: notifications.filter(n => n.type === 'performance')
    };
  }, [notifications]);

  const totalCount = notifications.length;

  return (
    <header className="fixed top-0 left-0 lg:left-80 right-0 bg-gray-900 border-b border-gray-700 px-6 py-4 z-40 h-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-white">{viewTitles[currentView]}</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>System Online</span>
            </div>
            <span className="text-gray-600">•</span>
            <span>{viewSubtitles[currentView]}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          {/* Real-time Status Indicators */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Wifi className="h-4 w-4 text-green-400" />
              <span className="text-sm text-white font-medium">Connected</span>
            </div>
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-white font-medium">Models Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-white font-medium">Ryu Controller</span>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          {/* Notifications */}
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setOpen(v => !v)} className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
              <Bell className="h-5 w-5" />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {totalCount}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
                <div className="p-3 border-b border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 font-semibold">Notifications</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">{totalCount} new</span>
                      {totalCount > 0 && (
                        <button
                          onClick={() => {
                            onAcknowledgeAll && onAcknowledgeAll();
                            setOpen(false);
                          }}
                          className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm"
                          title="Clear all notifications"
                        >
                          Acknowledge All
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="max-h-96 overflow-auto divide-y divide-gray-800">
                  {totalCount === 0 ? (
                    <div className="p-6 text-center">
                      <Bell className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No notifications</p>
                      <p className="text-xs text-gray-500 mt-1">All caught up!</p>
                    </div>
                  ) : (
                    <>
                      {/* Attack Detection Section */}
                      <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <span className="text-xs uppercase text-gray-400">Attack Detection</span>
                      </div>
                      <button
                        className="text-xs text-blue-400 hover:text-blue-300"
                        onClick={() => { setOpen(false); onNavigate && onNavigate('attacks'); }}
                      >
                        View
                      </button>
                    </div>
                    {sections.attacks.length === 0 ? (
                      <div className="text-xs text-gray-500">No attack notifications</div>
                    ) : (
                      <ul className="space-y-2">
                        {sections.attacks.map(n => (
                          <li key={n.id} className="flex items-start justify-between bg-gray-800/50 rounded-md p-2">
                            <div className="flex-1">
                              <p className="text-sm text-white">{n.title}</p>
                              <p className="text-xs text-gray-400">{n.message}</p>
                              <p className="text-[10px] text-gray-500 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center space-x-2 ml-2">
                              <button
                                className="text-xs text-blue-400 hover:text-blue-300"
                                onClick={() => { setOpen(false); onNavigate && onNavigate('attacks'); }}
                              >
                                Open
                              </button>
                              <button
                                className="p-1 text-gray-400 hover:text-white"
                                onClick={() => onDismissNotification && onDismissNotification(n.id)}
                                aria-label="Dismiss"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Performance Section */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Activity className="h-4 w-4 text-yellow-400" />
                        <span className="text-xs uppercase text-gray-400">Performance</span>
                      </div>
                      <button
                        className="text-xs text-blue-400 hover:text-blue-300"
                        onClick={() => { setOpen(false); onNavigate && onNavigate('performance'); }}
                      >
                        View
                      </button>
                    </div>
                    {sections.performance.length === 0 ? (
                      <div className="text-xs text-gray-500">No performance notifications</div>
                    ) : (
                      <ul className="space-y-2">
                        {sections.performance.map(n => (
                          <li key={n.id} className="flex items-start justify-between bg-gray-800/50 rounded-md p-2">
                            <div className="flex-1">
                              <p className="text-sm text-white">{n.title}</p>
                              <p className="text-xs text-gray-400">{n.message}</p>
                              <p className="text-[10px] text-gray-500 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center space-x-2 ml-2">
                              <button
                                className="text-xs text-blue-400 hover:text-blue-300"
                                onClick={() => { setOpen(false); onNavigate && onNavigate('performance'); }}
                              >
                                Open
                              </button>
                              <button
                                className="p-1 text-gray-400 hover:text-white"
                                onClick={() => onDismissNotification && onDismissNotification(n.id)}
                                aria-label="Dismiss"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};