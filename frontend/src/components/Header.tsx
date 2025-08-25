import React from 'react';
import { Bell, Wifi, Brain, Server } from 'lucide-react';
import { ViewType } from '../App';
import { User } from '../services/authService';

interface HeaderProps {
  onMenuClick: () => void;
  currentView: ViewType;
  currentUser: User | null;
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

export const Header: React.FC<HeaderProps> = ({ onMenuClick, currentView, currentUser }) => {
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
          <button className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </button>

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