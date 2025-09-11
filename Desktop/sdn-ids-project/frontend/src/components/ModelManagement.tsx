import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Upload, 
  Download, 
  Trash2, 
  Play, 
  Pause, 
  Settings,
  FileText,
  Star, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Zap,
  BarChart3,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';

interface Model {
  id: string;
  name: string;
  version: string;
  format: string;
  framework: string;
  description: string;
  size_bytes: number;
  is_active: boolean;
  accuracy?: number;
  precision_score?: number;
  recall_score?: number;
  f1_score?: number;
  training_samples?: number;
  test_samples?: number;
  created_at: string;
  uploaded_by?: string;
}

export const ModelManagement: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [meta, setMeta] = useState({ 
    name: '', 
    version: '', 
    framework: '', 
    description: '',
    accuracy: '',
    precision_score: '',
    recall_score: '',
    f1_score: '',
    training_samples: '',
    test_samples: ''
  });
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ml/models', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data?.success) {
        setModels(data.models || []);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

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
      if (ext === 'pkl' || ext === 'h5' || ext === 'joblib') {
        setSelectedFile(file);
        setShowUploadForm(true);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pkl' || ext === 'h5' || ext === 'joblib') {
        setSelectedFile(file);
        setShowUploadForm(true);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!(ext === 'pkl' || ext === 'h5' || ext === 'joblib')) {
      alert('Please upload a .pkl, .h5, or .joblib file');
      return;
    }

    setUploading(true);
    try {
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
          base64Content,
          accuracy: meta.accuracy ? parseFloat(meta.accuracy) : undefined,
          precision_score: meta.precision_score ? parseFloat(meta.precision_score) : undefined,
          recall_score: meta.recall_score ? parseFloat(meta.recall_score) : undefined,
          f1_score: meta.f1_score ? parseFloat(meta.f1_score) : undefined,
          training_samples: meta.training_samples ? parseInt(meta.training_samples) : undefined,
          test_samples: meta.test_samples ? parseInt(meta.test_samples) : undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Upload failed');
      }

      setSelectedFile(null);
      setMeta({ 
        name: '', 
        version: '', 
        framework: '', 
        description: '',
        accuracy: '',
        precision_score: '',
        recall_score: '',
        f1_score: '',
        training_samples: '',
        test_samples: ''
      });
      setShowUploadForm(false);
      await fetchModels();
    } catch (err: any) {
      alert(err.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  const activateModel = async (id: string) => {
    try {
      const res = await fetch(`/api/ml/models/${id}/activate`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Activation failed');
      }
      setModels(models.map(m => ({ ...m, is_active: m.id === id ? true : false })));
    } catch (e: any) {
      alert(e.message || 'Activation error');
    }
  };

  const deactivateModel = async (id: string) => {
    try {
      const res = await fetch(`/api/ml/models/${id}/deactivate`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Deactivation failed');
      }
      setModels(models.map(m => ({ ...m, is_active: m.id === id ? false : m.is_active })));
    } catch (e: any) {
      alert(e.message || 'Deactivation error');
    }
  };

  const deleteModel = async (id: string) => {
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
  };

  const downloadModel = async (id: string) => {
    try {
      const res = await fetch(`/api/models/${id}/download`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `model_${id}.${models.find(m => m.id === id)?.format || 'pkl'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (e: any) {
      alert(e.message || 'Download error');
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return 'text-green-400';
    if (accuracy >= 0.8) return 'text-yellow-400';
    return 'text-red-400';
  };

  const filteredModels = models
    .filter(model => {
      if (filter === 'active') return model.is_active;
      if (filter === 'inactive') return !model.is_active;
      return true;
    })
    .filter(model => 
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.framework.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortBy as keyof Model];
      const bVal = b[sortBy as keyof Model];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });

  if (loading) {
  return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Model Management</h1>
          <p className="text-gray-400 mt-2">Upload, manage, and deploy ML models for attack detection</p>
        </div>
        <button
          onClick={() => setShowUploadForm(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Model</span>
          </button>
        </div>

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Upload New Model</h2>
        <button
                onClick={() => setShowUploadForm(false)}
                className="text-gray-400 hover:text-white"
              >
                <EyeOff className="h-5 w-5" />
        </button>
      </div>

            <form onSubmit={handleUpload} className="space-y-6">
              {/* Model Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" 
                  placeholder="Model name" 
                  value={meta.name} 
                  onChange={(e) => setMeta({ ...meta, name: e.target.value })} 
                  required
                />
                <input 
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" 
                  placeholder="Version (e.g., 1.0.0)" 
                  value={meta.version} 
                  onChange={(e) => setMeta({ ...meta, version: e.target.value })} 
                  required
                />
                <select 
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  value={meta.framework} 
                  onChange={(e) => setMeta({ ...meta, framework: e.target.value })}
                >
                  <option value="">Select framework</option>
                  <option value="scikit-learn">Scikit-learn</option>
                  <option value="tensorflow">TensorFlow</option>
                  <option value="pytorch">PyTorch</option>
                  <option value="xgboost">XGBoost</option>
                  <option value="lightgbm">LightGBM</option>
                </select>
                <input 
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" 
                  placeholder="Description" 
                  value={meta.description} 
                  onChange={(e) => setMeta({ ...meta, description: e.target.value })} 
                />
              </div>

              {/* Performance Metrics */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3">Performance Metrics (Optional)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" 
                    placeholder="Accuracy (0.0-1.0)" 
                    value={meta.accuracy} 
                    onChange={(e) => setMeta({ ...meta, accuracy: e.target.value })} 
                  />
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" 
                    placeholder="Precision (0.0-1.0)" 
                    value={meta.precision_score} 
                    onChange={(e) => setMeta({ ...meta, precision_score: e.target.value })} 
                  />
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" 
                    placeholder="Recall (0.0-1.0)" 
                    value={meta.recall_score} 
                    onChange={(e) => setMeta({ ...meta, recall_score: e.target.value })} 
                  />
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" 
                    placeholder="F1 Score (0.0-1.0)" 
                    value={meta.f1_score} 
                    onChange={(e) => setMeta({ ...meta, f1_score: e.target.value })} 
                  />
                  <input 
                    type="number"
                    min="0"
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" 
                    placeholder="Training samples" 
                    value={meta.training_samples} 
                    onChange={(e) => setMeta({ ...meta, training_samples: e.target.value })} 
                  />
                  <input 
                    type="number"
                    min="0"
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" 
                    placeholder="Test samples" 
                    value={meta.test_samples} 
                    onChange={(e) => setMeta({ ...meta, test_samples: e.target.value })} 
                  />
                </div>
              </div>

              {/* File Upload */}
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragOver 
                    ? 'border-blue-400 bg-blue-500/10' 
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-400" />
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
                    <p className="text-sm text-gray-400 mb-3">or click to browse (.pkl, .h5, .joblib files supported)</p>
                    <input 
                      type="file" 
                      accept=".pkl,.h5,.joblib" 
                      onChange={handleFileSelect} 
                      className="hidden" 
                      id="fileInput"
                    />
                    <label 
                      htmlFor="fileInput"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors inline-block"
                    >
                      Browse Files
                    </label>
            </div>
                )}
      </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              <button
                  type="submit" 
                  disabled={uploading || !selectedFile} 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                  {uploading ? 'Uploading...' : 'Upload Model'}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
                <input
                  type="text"
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                />
              </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
          >
            <option value="all">All Models</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
                <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
          >
            <option value="created_at">Created Date</option>
            <option value="name">Name</option>
            <option value="accuracy">Accuracy</option>
            <option value="size_bytes">Size</option>
                </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white hover:bg-gray-600 transition-colors"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
              </div>

      {/* Models Grid */}
      <div className="grid gap-6">
        {filteredModels.map((model) => (
          <div 
            key={model.id} 
            className={`bg-gray-800/80 border rounded-xl p-6 transition-all hover:border-gray-600 ${
              model.is_active ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-white">{model.name}</h3>
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
                    <p className={`font-medium ${getAccuracyColor(model.accuracy ? model.accuracy * 100 : 0)}`}>
                      {model.accuracy ? `${(model.accuracy * 100).toFixed(1)}%` : 'N/A'}
                </p>
              </div>
            </div>

                {/* Additional Performance Metrics */}
                {(model.accuracy || model.precision_score || model.recall_score || model.f1_score) && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {model.precision_score && (
                        <div>
                          <span className="text-gray-500">Precision</span>
                          <p className="text-white font-medium">{(model.precision_score * 100).toFixed(1)}%</p>
            </div>
                      )}
                      {model.recall_score && (
                        <div>
                          <span className="text-gray-500">Recall</span>
                          <p className="text-white font-medium">{(model.recall_score * 100).toFixed(1)}%</p>
          </div>
                      )}
                      {model.f1_score && (
                        <div>
                          <span className="text-gray-500">F1 Score</span>
                          <p className="text-white font-medium">{(model.f1_score * 100).toFixed(1)}%</p>
        </div>
      )}
                      {(model.training_samples || model.test_samples) && (
              <div>
                          <span className="text-gray-500">Samples</span>
                          <p className="text-white font-medium">
                            {model.training_samples ? `${model.training_samples} train` : ''}
                            {model.training_samples && model.test_samples ? ' / ' : ''}
                            {model.test_samples ? `${model.test_samples} test` : ''}
                          </p>
                        </div>
                      )}
              </div>
                  </div>
                )}
            </div>

              <div className="flex items-center space-x-2 ml-4">
                {model.is_active ? (
                  <button 
                    onClick={() => deactivateModel(model.id)}
                    className="flex items-center space-x-1 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Pause className="h-3 w-3" />
                    <span>Deactivate</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => activateModel(model.id)}
                    className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Play className="h-3 w-3" />
                    <span>Activate</span>
                  </button>
                )}
              <button
                  onClick={() => downloadModel(model.id)}
                  className="flex items-center space-x-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-blue-600/30"
              >
                  <Download className="h-3 w-3" />
                  <span>Download</span>
              </button>
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

      {filteredModels.length === 0 && (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No models found</h3>
          <p className="text-gray-400 mb-4">
            {searchTerm ? 'Try adjusting your search terms' : 'Upload your first model to get started'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowUploadForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Upload Model
            </button>
          )}
        </div>
      )}
    </div>
  );
};





