const API = {
  get accessToken() { return localStorage.getItem('accessToken'); },
  set accessToken(token) { localStorage.setItem('accessToken', token); },
  clearTokens() { localStorage.removeItem('accessToken'); },

  async request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(url, { ...options, headers, credentials: 'include' });

    if (response.status === 403) {
      const data = await response.json().catch(() => ({}));
      if (data.message && data.message.includes('访问令牌')) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          response = await fetch(url, { ...options, headers, credentials: 'include' });
        }
      }
    }

    if (response.status === 401) {
      this.clearTokens();
      window.location.href = '/login';
      return null;
    }

    return response;
  },

  async refreshToken() {
    try {
      const res = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        this.accessToken = data.accessToken;
        return true;
      }
    } catch (e) { console.error('Token refresh failed:', e); }
    this.clearTokens();
    return false;
  },

  async login(account, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password }),
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok) {
      this.accessToken = data.accessToken;
    }
    return { ok: res.ok, data };
  },

  async register(username, email, phone, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, phone, password })
    });
    const data = await res.json();
    return { ok: res.ok, data };
  },

  async logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    this.clearTokens();
    window.location.href = '/login';
  },

  async getMenus() {
    const res = await this.request('/api/auth/menus');
    return res ? res.json() : null;
  },

  async getCustomers() {
    const res = await this.request('/api/customers');
    return res ? res.json() : null;
  },

  async getCustomerById(id) {
    const res = await this.request(`/api/customers/${id}`);
    return res ? res.json() : null;
  },

  async getRoles() {
    const res = await this.request('/api/roles');
    return res ? res.json() : null;
  },

  async getUsers() {
    const res = await this.request('/api/users');
    return res ? res.json() : null;
  },

  async getAllMenus() {
    const res = await this.request('/api/menus/flat');
    return res ? res.json() : null;
  }
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMenu(menus) {
  const sidebar = document.getElementById('sidebar-menu');
  if (!sidebar) return;

  sidebar.innerHTML = '';

  menus.forEach(menu => {
    const li = document.createElement('li');
    li.className = 'nav-item';

    if (menu.children && menu.children.length > 0) {
      li.innerHTML = `
        <a href="#submenu-${menu.id}" data-bs-toggle="collapse" class="nav-link">
          <i class="bi bi-${menu.icon || 'circle'}"></i>
          <span>${escapeHtml(menu.name)}</span>
          <i class="bi bi-chevron-down ms-auto"></i>
        </a>
        <ul class="submenu collapse" id="submenu-${menu.id}">
          ${menu.children.map(child => `
            <li><a class="nav-link" href="${child.path}"><span>${escapeHtml(child.name)}</span></a></li>
          `).join('')}
        </ul>
      `;
    } else {
      li.innerHTML = `
        <a href="${menu.path}" class="nav-link">
          <i class="bi bi-${menu.icon || 'circle'}"></i>
          <span>${escapeHtml(menu.name)}</span>
        </a>
      `;
    }

    sidebar.appendChild(li);
  });
}

async function loadLayout() {
  const menuData = await API.getMenus();
  if (menuData && menuData.menus) {
    renderMenu(menuData.menus);
    const userInfo = document.getElementById('user-info');
    if (userInfo && menuData.user) {
      userInfo.innerHTML = `
        <span class="me-2">${escapeHtml(menuData.user.username)}</span>
        <span class="badge bg-secondary">${escapeHtml(menuData.user.roleName)}</span>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      API.logout();
    });
  }

  if (!document.body.classList.contains('auth-page')) {
    loadLayout();
  }
});

window.API = API;
window.escapeHtml = escapeHtml;
