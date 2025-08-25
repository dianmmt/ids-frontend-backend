import React, { useState } from 'react';
import { 
  Settings2, 
  Bell, 
  Shield, 
  Database, 
  Network, 
  Save, 
  TestTube,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Brain,
  Activity,
  Clock,
  Mail,
  Phone,
  Key,
  Server
} from 'lucide-react';

interface SystemSettings {
  ryuControllerUrl: string;
  ryuWebsocketUrl: string;
  mlModelPath: string;
  mlInferencePath: string;
  databaseUrl: string;
  enableRealTimeUpdates: boolean;
  updateInterval: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
    mlInferenceLatency: number;
    attackDetectionConfidence: number;
  };
  notificationSettings: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    emailAddress: string;
    minSeverity: string;
    quietHoursStart: string;
    quietHoursEnd: string;
  };
  securitySettings: {
    sessionTimeout: number;
    maxFailedLogins: number;
    passwordMinLength: number;
    requireMFA: boolean;
    enableAuditLog: boolean;
  };
  mlSettings: {
    modelUpdateInterval: number;
    trainingDataRetention: number;
    autoRetrain: boolean;
    minTrainingData: number;
  };
}

const defaultSettings: SystemSettings = {
  ryuControllerUrl: 'http://localhost:8080',
  ryuWebsocketUrl: 'ws://localhost:8080/v1.0/ws',
  mlModelPath: './models/sdn_ids_model.pkl',
  mlInferencePath: './inference/threat_detection.py',
  databaseUrl: '***',
  enableRealTimeUpdates: true,
  updateInterval: 5,
  alertThresholds: {
    cpuUsage: 80,
    memoryUsage: 85,
    diskUsage: 90,
    networkLatency: 100,
    mlInferenceLatency: 1000,
    attackDetectionConfidence: 75,
  },
  notificationSettings: {
    emailEnabled: true,
    smsEnabled: false,
    emailAddress: 'admin@company.com',
    minSeverity: 'medium',
    quietHoursStart: '22:00',
    quietHoursEnd: '06:00',
  },
  securitySettings: {
    sessionTimeout: 1440,
    maxFailedLogins: 5,
    passwordMinLength: 8,
    requireMFA: false,
    enableAuditLog: true,
  },
  mlSettings: {
    modelUpdateInterval: 24,
    trainingDataRetention: 30,
    autoRetrain: true,
    minTrainingData: 1000,
  },
};

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [connectionStatuses, setConnectionStatuses] = useState({
    ryu: 'connected',
    database: 'connected',
    ml: 'connected',
  });
  const [showDatabaseUrl, setShowDatabaseUrl] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('controller');

  const updateSetting = (path: string, value: any) => {
    const keys = path.split('.');
    const newSettings = { ...settings };
    let current: any = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    setSettings(newSettings);
    setHasUnsavedChanges(true);
  };

  const testConnection = async (type: string) => {
    setConnectionStatuses(prev => ({ ...prev, [type]: 'testing' }));
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setConnectionStatuses(prev => ({ ...prev, [type]: 'connected' }));
    } catch (error) {
      setConnectionStatuses(prev => ({ ...prev, [type]: 'error' }));
    }
  };

  const saveSettings = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setHasUnsavedChanges(false);
      alert('Settings saved successfully!');
    } catch (error) {
      alert('Failed to save settings. Please try again.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'testing':
        return <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
      default:
        return <div className="h-4 w-4 bg-gray-500 rounded-full" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      connected: 'bg-green-400/20 text-green-400 border-green-400/30',
      error: 'bg-red-400/20 text-red-400 border-red-400/30',
      testing: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
      unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colors[status as keyof typeof colors] || colors.unknown}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const tabs = [
    { id: 'controller', label: 'SDN Controller', icon: Network },
    { id: 'ml', label: 'Machine Learning', icon: Brain },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'alerts', label: 'Alert Thresholds', icon: AlertTriangle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-2">System configuration and preferences</p>
        </div>
        {hasUnsavedChanges && (
          <button
            onClick={saveSettings}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>Save Changes</span>
          </button>
        )}
      </div>

      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <span className="font-medium text-yellow-400">You have unsaved changes</span>
            </div>
            <button
              onClick={saveSettings}
              className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Save Now
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-2 bg-gray-800/50 p-2 rounded-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
        {/* SDN Controller Tab */}
        {activeTab === 'controller' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Network className="h-6 w-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">SDN Controller Configuration</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Ryu Controller URL</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={settings.ryuControllerUrl}
                    onChange={(e) => updateSetting('ryuControllerUrl', e.target.value)}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                    placeholder="http://localhost:8080"
                  />
                  <button
                    onClick={() => testConnection('ryu')}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                    disabled={connectionStatuses.ryu === 'testing'}
                  >
                    <TestTube className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(connectionStatuses.ryu)}
                  {getStatusBadge(connectionStatuses.ryu)}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">WebSocket URL</label>
                <input
                  type="text"
                  value={settings.ryuWebsocketUrl}
                  onChange={(e) => updateSetting('ryuWebsocketUrl', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="ws://localhost:8080/v1.0/ws"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="realtime"
                  checked={settings.enableRealTimeUpdates}
                  onChange={(e) => updateSetting('enableRealTimeUpdates', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="realtime" className="text-sm font-medium text-gray-300">Enable Real-time Updates</label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-300">Update Interval (seconds):</label>
                <input
                  type="number"
                  value={settings.updateInterval}
                  onChange={(e) => updateSetting('updateInterval', parseInt(e.target.value))}
                  className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-blue-400"
                  min="1"
                  max="300"
                />
              </div>
            </div>
          </div>
        )}

        {/* Machine Learning Tab */}
        {activeTab === 'ml' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Brain className="h-6 w-6 text-purple-400" />
              <h2 className="text-xl font-semibold text-white">Machine Learning Configuration</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Model Path</label>
                <input
                  type="text"
                  value={settings.mlModelPath}
                  onChange={(e) => updateSetting('mlModelPath', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="./models/sdn_ids_model.pkl"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Inference Script Path</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={settings.mlInferencePath}
                    onChange={(e) => updateSetting('mlInferencePath', e.target.value)}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                    placeholder="./inference/threat_detection.py"
                  />
                  <button
                    onClick={() => testConnection('ml')}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                    disabled={connectionStatuses.ml === 'testing'}
                  >
                    <TestTube className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(connectionStatuses.ml)}
                  {getStatusBadge(connectionStatuses.ml)}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Model Update Interval (hours)</label>
                <input
                  type="number"
                  value={settings.mlSettings.modelUpdateInterval}
                  onChange={(e) => updateSetting('mlSettings.modelUpdateInterval', parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="1"
                  max="168"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Training Data Retention (days)</label>
                <input
                  type="number"
                  value={settings.mlSettings.trainingDataRetention}
                  onChange={(e) => updateSetting('mlSettings.trainingDataRetention', parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="1"
                  max="365"
                />
              </div>
            </div>

            <div className="flex items-center space-x-6 pt-4 border-t border-gray-700">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="autoRetrain"
                  checked={settings.mlSettings.autoRetrain}
                  onChange={(e) => updateSetting('mlSettings.autoRetrain', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="autoRetrain" className="text-sm font-medium text-gray-300">Enable Auto-Retraining</label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-300">Min Training Data:</label>
                <input
                  type="number"
                  value={settings.mlSettings.minTrainingData}
                  onChange={(e) => updateSetting('mlSettings.minTrainingData', parseInt(e.target.value))}
                  className="w-24 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-blue-400"
                  min="100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Database Tab */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Database className="h-6 w-6 text-green-400" />
              <h2 className="text-xl font-semibold text-white">Database Configuration</h2>
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">Database URL</label>
              <div className="flex space-x-2">
                <input
                  type={showDatabaseUrl ? "text" : "password"}
                  value={settings.databaseUrl}
                  onChange={(e) => updateSetting('databaseUrl', e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="postgresql://user:password@localhost:5432/sdn_ids"
                />
                <button
                  onClick={() => setShowDatabaseUrl(!showDatabaseUrl)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  {showDatabaseUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(connectionStatuses.database)}
                {getStatusBadge(connectionStatuses.database)}
              </div>
            </div>
          </div>
        )}

        {/* Alert Thresholds Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <AlertTriangle className="h-6 w-6 text-yellow-400" />
              <h2 className="text-xl font-semibold text-white">Alert Thresholds</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">CPU Usage (%)</label>
                <input
                  type="number"
                  value={settings.alertThresholds.cpuUsage}
                  onChange={(e) => updateSetting('alertThresholds.cpuUsage', parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="0"
                  max="100"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Memory Usage (%)</label>
                <input
                  type="number"
                  value={settings.alertThresholds.memoryUsage}
                  onChange={(e) => updateSetting('alertThresholds.memoryUsage', parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="0"
                  max="100"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Disk Usage (%)</label>
                <input
                  type="number"
                  value={settings.alertThresholds.diskUsage}
                  onChange={(e) => updateSetting('alertThresholds.diskUsage', parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="0"
                  max="100"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Network Latency (ms)</label>
                <input
                  type="number"
                  value={settings.alertThresholds.networkLatency}
                  onChange={(e) => updateSetting('alertThresholds.networkLatency', parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="0"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">ML Inference Latency (ms)</label>
                <input
                  type="number"
                  value={settings.alertThresholds.mlInferenceLatency}
                  onChange={(e) => updateSetting('alertThresholds.mlInferenceLatency', parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="0"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Attack Detection Confidence (%)</label>
                <input
                  type="number"
                  value={settings.alertThresholds.attackDetectionConfidence}
                  onChange={(e) => updateSetting('alertThresholds.attackDetectionConfidence', parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Bell className="h-6 w-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Notification Settings</h2>
            </div>
            
            <div className="flex items-center space-x-8 mb-6">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  checked={settings.notificationSettings.emailEnabled}
                  onChange={(e) => updateSetting('notificationSettings.emailEnabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="emailNotifications" className="text-sm font-medium text-gray-300">Email Notifications</label>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="smsNotifications"
                  checked={settings.notificationSettings.smsEnabled}
                  onChange={(e) => updateSetting('notificationSettings.smsEnabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="smsNotifications" className="text-sm font-medium text-gray-300">SMS Notifications</label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Email Address</label>
                <input
                  type="email"
                  value={settings.notificationSettings.emailAddress}
                  onChange={(e) => updateSetting('notificationSettings.emailAddress', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  placeholder="admin@company.com"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Minimum Severity</label>
                <select
                  value={settings.notificationSettings.minSeverity}
                  onChange={(e) => updateSetting('notificationSettings.minSeverity', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Quiet Hours Start</label>
                <input
                  type="time"
                  value={settings.notificationSettings.quietHoursStart}
                  onChange={(e) => updateSetting('notificationSettings.quietHoursStart', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Quiet Hours End</label>
                <input
                  type="time"
                  value={settings.notificationSettings.quietHoursEnd}
                  onChange={(e) => updateSetting('notificationSettings.quietHoursEnd', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Shield className="h-6 w-6 text-red-400" />
              <h2 className="text-xl font-semibold text-white">Security Settings</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Session Timeout (minutes)</label>
                <input
                  type="number"
                  value={settings.securitySettings.sessionTimeout}
                  onChange={(e) => updateSetting('securitySettings.sessionTimeout', parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="15"
                  max="10080"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Max Failed Login Attempts</label>
                <input
                  type="number"
                  value={settings.securitySettings.maxFailedLogins}
                  onChange={(e) => updateSetting('securitySettings.maxFailedLogins', parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="1"
                  max="20"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Minimum Password Length</label>
                <input
                  type="number"
                  value={settings.securitySettings.passwordMinLength}
                  onChange={(e) => updateSetting('securitySettings.passwordMinLength', parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  min="4"
                  max="32"
                />
              </div>
            </div>

            <div className="flex flex-col space-y-4 pt-4 border-t border-gray-700">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="requireMFA"
                  checked={settings.securitySettings.requireMFA}
                  onChange={(e) => updateSetting('securitySettings.requireMFA', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="requireMFA" className="text-sm font-medium text-gray-300">Require Multi-Factor Authentication</label>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enableAuditLog"
                  checked={settings.securitySettings.enableAuditLog}
                  onChange={(e) => updateSetting('securitySettings.enableAuditLog', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="enableAuditLog" className="text-sm font-medium text-gray-300">Enable Audit Logging</label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button 
          onClick={saveSettings}
          disabled={!hasUnsavedChanges}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
            hasUnsavedChanges 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save className="h-4 w-4" />
          <span>Save All Settings</span>
        </button>
      </div>
    </div>
  );
};