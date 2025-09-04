import React, { useState, useEffect } from 'react';
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
  Server,
  Upload,
  Play,
  Trash2,
  Download,
  FileText,
  Zap,
  Star
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
  const [models, setModels] = useState<any[]>([
    {
      id: '1',
      name: 'SDN IDS Model v2.1',
      version: '2.1.0',
      format: 'pkl',
      size_bytes: 45000000,
      is_active: true,
      framework: 'scikit-learn',
      accuracy: 94.2,
      created_at: '2024-08-15T10:30:00Z',
      description: 'Advanced intrusion detection model with improved accuracy'
    },
    {
      id: '2',
      name: 'Network Anomaly Detector',
      version: '1.5.2',
      format: 'h5',
      size_bytes: 78000000,
      is_active: false,
      framework: 'tensorflow',
      accuracy: 91.8,
      created_at: '2024-08-10T14:20:00Z',
      description: 'Deep learning model for network anomaly detection'
    },
    {
      id: '3',
      name: 'Traffic Classification Model',
      version: '1.0.0',
      format: 'pkl',
      size_bytes: 23000000,
      is_active: false,
      framework: 'xgboost',
      accuracy: 89.5,
      created_at: '2024-08-05T09:15:00Z',
      description: 'XGBoost model for network traffic classification'
    }
  ]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ name: '', version: '', framework: '', description: '' });
  const [dragOver, setDragOver] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  async function fetchModels() {
    try {
      const res = await fetch('/api/ml/models', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data?.success) setModels(data.models);
    } catch (e) {
      // noop
    }
  }

  useEffect(() => {
    if (activeTab === 'ml') {
      fetchModels();
    }
  }, [activeTab]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pkl' || ext === 'h5') {
        setSelectedFile(file);
      }
    }
  };

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!(ext === 'pkl' || ext === 'h5')) {
      alert('Please upload a .pkl or .h5 file');
      return;
    }
    setUploading(true);
    try {
      // Use FileReader to avoid stack overflow on large files
      const base64Content: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || '';
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsDataURL(selectedFile);
      });
      const res = await fetch('/api/ml/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: meta.name || selectedFile.name.replace(/\.[^.]+$/, ''),
          version: meta.version || '1.0.0',
          format: ext,
          framework: meta.framework || undefined,
          description: meta.description || undefined,
          base64Content
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Upload failed');
      setSelectedFile(null);
      setMeta({ name: '', version: '', framework: '', description: '' });
      await fetchModels();
    } catch (err: any) {
      alert(err.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  }

  async function activateModel(id: string) {
    try {
      const res = await fetch(`/api/ml/models/${id}/activate`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Activation failed');
      setModels(models.map(m => ({ ...m, is_active: m.id === id })));
    } catch (e: any) {
      alert(e.message || 'Activation error');
    }
  }

  async function deleteModel(id: string) {
    if (!confirm('Are you sure you want to delete this model?')) return;
    try {
      const res = await fetch(`/api/ml/models/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setModels(models.filter(m => m.id !== id));
      }
    } catch (e: any) {
      alert(e.message || 'Delete error');
    }
  }

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

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-green-400';
    if (accuracy >= 80) return 'text-yellow-400';
    return 'text-red-400';
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

        {/* Machine Learning Tab - Redesigned */}
        {activeTab === 'ml' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <Brain className="h-6 w-6 text-purple-400" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Machine Learning Models</h2>
                  <p className="text-sm text-gray-400 mt-1">Manage your AI models for threat detection and network analysis</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <Activity className="h-4 w-4" />
                <span>{models.filter(m => m.is_active).length} active model{models.filter(m => m.is_active).length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Upload Section */}
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Upload className="h-5 w-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Upload New Model</h3>
              </div>
              
              <form onSubmit={handleUpload} className="space-y-4">
                {/* Model Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    className="bg-gray-700/80 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400" 
                    placeholder="Model name" 
                    value={meta.name} 
                    onChange={(e) => setMeta({ ...meta, name: e.target.value })} 
                  />
                  <input 
                    className="bg-gray-700/80 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400" 
                    placeholder="Version (e.g., 1.0.0)" 
                    value={meta.version} 
                    onChange={(e) => setMeta({ ...meta, version: e.target.value })} 
                  />
                  <select 
                    className="bg-gray-700/80 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    value={meta.framework} 
                    onChange={(e) => setMeta({ ...meta, framework: e.target.value })}
                  >
                    <option value="">Select framework (optional)</option>
                    <option value="scikit-learn">Scikit-learn</option>
                    <option value="tensorflow">TensorFlow</option>
                    <option value="pytorch">PyTorch</option>
                    <option value="xgboost">XGBoost</option>
                    <option value="lightgbm">LightGBM</option>
                  </select>
                  <input 
                    className="bg-gray-700/80 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400" 
                    placeholder="Description (optional)" 
                    value={meta.description} 
                    onChange={(e) => setMeta({ ...meta, description: e.target.value })} 
                  />
                </div>

                {/* File Upload Area */}
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragOver 
                      ? 'border-purple-400 bg-purple-500/10' 
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center space-x-2">
                      <FileText className="h-5 w-5 text-purple-400" />
                      <span className="text-white font-medium">{selectedFile.name}</span>
                      <span className="text-gray-400">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      <button 
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="ml-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-300 mb-1">Drag and drop your model file here</p>
                      <p className="text-sm text-gray-400 mb-3">or click to browse (.pkl, .h5 files supported)</p>
                      <input 
                        type="file" 
                        accept=".pkl,.h5" 
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} 
                        className="hidden" 
                        id="fileInput"
                      />
                      <label 
                        htmlFor="fileInput"
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors inline-block"
                      >
                        Browse Files
                      </label>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={uploading || !selectedFile} 
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center justify-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload Model</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Models List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Deployed Models</h3>
                <span className="text-sm text-gray-400">{models.length} models total</span>
              </div>
              
              <div className="grid gap-4">
                {models.map((model) => (
                  <div 
                    key={model.id} 
                    className={`bg-gray-800/80 border rounded-xl p-6 transition-all hover:border-gray-600 ${
                      model.is_active ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-semibold text-white">{model.name}</h4>
                          {model.is_active && (
                            <span className="flex items-center space-x-1 bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-medium border border-green-500/30">
                              <Star className="h-3 w-3" />
                              <span>Active</span>
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mb-3">{model.description || 'No description provided'}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Version</span>
                            <p className="text-white font-medium">{model.version}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Framework</span>
                            <p className="text-white font-medium">{model.framework || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Size</span>
                            <p className="text-white font-medium">{(model.size_bytes / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Accuracy</span>
                            <p className={`font-medium ${getAccuracyColor(model.accuracy)}`}>
                              {model.accuracy ? `${model.accuracy}%` : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {!model.is_active && (
                          <button 
                            onClick={() => activateModel(model.id)}
                            className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Play className="h-3 w-3" />
                            <span>Activate</span>
                          </button>
                        )}
                        <button 
                          onClick={() => deleteModel(model.id)}
                          className="flex items-center space-x-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-red-600/30"
                          disabled={model.is_active}
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-700">
                      <span>Format: {model.format.toUpperCase()}</span>
                      <span>Created: {new Date(model.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
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