import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Key,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  createdAt: string;
  permissions: string[];
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      username: 'admin',
      email: 'admin@company.com',
      role: 'admin',
      status: 'active',
      lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      permissions: ['all']
    },
    {
      id: '2',
      username: 'security_analyst',
      email: 'analyst@company.com',
      role: 'analyst',
      status: 'active',
      lastLogin: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      permissions: ['view_attacks', 'manage_alerts', 'view_analytics']
    },
    {
      id: '3',
      username: 'network_viewer',
      email: 'viewer@company.com',
      role: 'viewer',
      status: 'active',
      lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      permissions: ['view_dashboard', 'view_topology']
    },
    {
      id: '4',
      username: 'temp_analyst',
      email: 'temp@company.com',
      role: 'analyst',
      status: 'suspended',
      lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      permissions: ['view_attacks']
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddUser, setShowAddUser] = useState(false);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-red-400 bg-red-400/10';
      case 'analyst':
        return 'text-blue-400 bg-blue-400/10';
      case 'viewer':
        return 'text-green-400 bg-green-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'inactive':
        return 'text-gray-400';
      case 'suspended':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return CheckCircle;
      case 'inactive':
        return Clock;
      case 'suspended':
        return XCircle;
      default:
        return Clock;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const formatLastLogin = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* User Management Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-gray-400">Manage system users and permissions</p>
        </div>
        <button 
          onClick={() => setShowAddUser(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>Add User</span>
        </button>
      </div>

      {/* User Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Users className="text-blue-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">{users.length}</h3>
              <p className="text-blue-400 font-medium">Total Users</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3">
            <CheckCircle className="text-green-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">
                {users.filter(u => u.status === 'active').length}
              </h3>
              <p className="text-green-400 font-medium">Active Users</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Shield className="text-red-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">
                {users.filter(u => u.role === 'admin').length}
              </h3>
              <p className="text-red-400 font-medium">Administrators</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Clock className="text-yellow-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">
                {users.filter(u => new Date(u.lastLogin) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
              </h3>
              <p className="text-yellow-400 font-medium">Active Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex items-center space-x-2">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 w-64"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter size={20} className="text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="text-left p-4 text-gray-300 font-medium">User</th>
                <th className="text-left p-4 text-gray-300 font-medium">Role</th>
                <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                <th className="text-left p-4 text-gray-300 font-medium">Last Login</th>
                <th className="text-left p-4 text-gray-300 font-medium">Created</th>
                <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredUsers.map((user) => {
                const StatusIcon = getStatusIcon(user.status);
                
                return (
                  <tr key={user.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{user.username}</p>
                        <p className="text-gray-400 text-sm">{user.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(user.role)}`}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <StatusIcon size={16} className={getStatusColor(user.status)} />
                        <span className={`capitalize ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">
                      {formatLastLogin(user.lastLogin)}
                    </td>
                    <td className="p-4 text-gray-300">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg transition-colors">
                          <Edit size={16} />
                        </button>
                        <button className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-gray-700 rounded-lg transition-colors">
                          <Key size={16} />
                        </button>
                        <button className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors">
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Permissions Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="text-red-400" size={20} />
            <h3 className="text-lg font-semibold text-white">Administrator</h3>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center space-x-2 text-gray-300">
              <CheckCircle size={14} className="text-green-400" />
              <span>Full system access</span>
            </li>
            <li className="flex items-center space-x-2 text-gray-300">
              <CheckCircle size={14} className="text-green-400" />
              <span>User management</span>
            </li>
            <li className="flex items-center space-x-2 text-gray-300">
              <CheckCircle size={14} className="text-green-400" />
              <span>System configuration</span>
            </li>
            <li className="flex items-center space-x-2 text-gray-300">
              <CheckCircle size={14} className="text-green-400" />
              <span>ML model management</span>
            </li>
          </ul>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="text-blue-400" size={20} />
            <h3 className="text-lg font-semibold text-white">Security Analyst</h3>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center space-x-2 text-gray-300">
              <CheckCircle size={14} className="text-green-400" />
              <span>View attack data</span>
            </li>
            <li className="flex items-center space-x-2 text-gray-300">
              <CheckCircle size={14} className="text-green-400" />
              <span>Manage alerts</span>
            </li>
            <li className="flex items-center space-x-2 text-gray-300">
              <CheckCircle size={14} className="text-green-400" />
              <span>Generate reports</span>
            </li>
            <li className="flex items-center space-x-2 text-gray-300">
              <XCircle size={14} className="text-red-400" />
              <span>User management</span>
            </li>
          </ul>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="text-green-400" size={20} />
            <h3 className="text-lg font-semibold text-white">Viewer</h3>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center space-x-2 text-gray-300">
              <CheckCircle size={14} className="text-green-400" />
              <span>View dashboard</span>
            </li>
            <li className="flex items-center space-x-2 text-gray-300">
              <CheckCircle size={14} className="text-green-400" />
              <span>View network topology</span>
            </li>
            <li className="flex items-center space-x-2 text-gray-300">
              <XCircle size={14} className="text-red-400" />
              <span>Manage alerts</span>
            </li>
            <li className="flex items-center space-x-2 text-gray-300">
              <XCircle size={14} className="text-red-400" />
              <span>Export data</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};