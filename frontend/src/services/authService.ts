const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'analyst' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  last_login?: string;
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role?: 'analyst' | 'viewer';
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

export interface ProfileUpdateData {
  full_name?: string;
  email?: string;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

class AuthService {
  private token: string | null = null;

  // Set token (called after login)
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  // Get token from localStorage
  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('authToken');
    }
    return this.token;
  }

  // Remove token (called after logout)
  removeToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Get authorization header
  private getAuthHeader(): Record<string, string> {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // Make authenticated API request
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  }

  // User Registration
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Set token if registration is successful
      if (data.token) {
        this.setToken(data.token);
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // User Login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Set token if login is successful
      if (data.token) {
        this.setToken(data.token);
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // User Logout
  async logout(): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/auth/logout', {
        method: 'POST',
      });

      // Remove token regardless of response
      this.removeToken();

      return response;
    } catch (error) {
      // Remove token even if request fails
      this.removeToken();
      throw error;
    }
  }

  // Get User Profile
  async getProfile(): Promise<User> {
    const response = await this.makeRequest('/auth/profile');
    return response.user;
  }

  // Update User Profile
  async updateProfile(profileData: ProfileUpdateData): Promise<AuthResponse> {
    const response = await this.makeRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    return response;
  }

  // Change Password
  async changePassword(passwordData: PasswordChangeData): Promise<AuthResponse> {
    const response = await this.makeRequest('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    });
    return response;
  }

  // Verify Token
  async verifyToken(): Promise<{ valid: boolean; user?: User }> {
    try {
      const response = await this.makeRequest('/auth/verify');
      return { valid: true, user: response.user };
    } catch (error) {
      this.removeToken();
      return { valid: false };
    }
  }

  // Get All Users (Admin only)
  async getAllUsers(): Promise<User[]> {
    const response = await this.makeRequest('/auth/users');
    return response.users;
  }

  // Update User Status (Admin only)
  async updateUserStatus(userId: string, status: string): Promise<AuthResponse> {
    const response = await this.makeRequest(`/auth/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return response;
  }

  // Admin: Create User
  async adminCreateUser(payload: { username: string; email: string; full_name: string; password: string; role: 'admin' | 'analyst' | 'viewer' }): Promise<AuthResponse> {
    const response = await this.makeRequest('/auth/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response;
  }

  // Admin: Update User (email, full_name, role, status)
  async adminUpdateUser(userId: string, payload: Partial<{ email: string; full_name: string; role: 'admin' | 'analyst' | 'viewer'; status: 'active' | 'inactive' | 'suspended' }>): Promise<AuthResponse> {
    const response = await this.makeRequest(`/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return response;
  }

  // Admin: Delete User
  async adminDeleteUser(userId: string): Promise<AuthResponse> {
    const response = await this.makeRequest(`/auth/users/${userId}`, {
      method: 'DELETE',
    });
    return response;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Get current user from token (basic info)
  getCurrentUser(): User | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      // Decode JWT token (basic implementation)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.id,
        username: payload.username,
        email: payload.email,
        role: payload.role,
        status: payload.status,
        full_name: payload.full_name || '',
        created_at: payload.iat ? new Date(payload.iat * 1000).toISOString() : '',
      } as User;
    } catch (error) {
      return null;
    }
  }

  // Check if user has specific role
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  // Check if user is admin
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  // Check if user is analyst or admin
  isAnalystOrAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'analyst' || user?.role === 'admin';
  }

  // Fetch session info (last login from audit_logs and session duration)
  async getSessionInfo(): Promise<{ last_login: string | null; session_seconds: number }> {
    const response = await this.makeRequest('/auth/session-info');
    return { last_login: response.last_login, session_seconds: response.session_seconds };
  }
}

// Create singleton instance
export const authService = new AuthService();
export default authService;
