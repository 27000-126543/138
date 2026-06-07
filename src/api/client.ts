interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
  params?: Record<string, any>;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

class ApiClient {
  private baseUrl = '/api';
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private buildUrl(url: string, params?: Record<string, any>): string {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    if (!params || Object.keys(params).length === 0) return fullUrl;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return queryString ? `${fullUrl}?${queryString}` : fullUrl;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
      const errorData = await response.json().catch(() => ({ message: '请求失败' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data as T;
  }

  async get<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const fullUrl = this.buildUrl(url, options.params);
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: { ...this.getHeaders(), ...options.headers },
      ...options
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const fullUrl = this.buildUrl(url, options.params);
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: { ...this.getHeaders(), ...options.headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const fullUrl = this.buildUrl(url, options.params);
    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers: { ...this.getHeaders(), ...options.headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const fullUrl = this.buildUrl(url, options.params);
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: { ...this.getHeaders(), ...options.headers },
      ...options
    });
    return this.handleResponse<T>(response);
  }

  async upload<T>(url: string, formData: FormData, options: RequestOptions = {}): Promise<T> {
    const fullUrl = this.buildUrl(url, options.params);
    const headers = { ...options.headers };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: formData,
      ...options
    });
    return this.handleResponse<T>(response);
  }

  async download(url: string, filename: string, options: RequestOptions = {}): Promise<void> {
    const fullUrl = this.buildUrl(url, options.params);
    const headers = { ...this.getHeaders(), ...options.headers };
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      ...options
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

export const apiClient = new ApiClient();

export default apiClient;
