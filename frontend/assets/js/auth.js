// Verificar autenticação em todas as páginas protegidas
(function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const API_URL = 'http://localhost:3000/api';
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Verificar token válido
    fetch(`${API_URL}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
    }).catch(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
    
    // Adicionar info do usuário na interface
    window.addEventListener('DOMContentLoaded', () => {
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `
            <span><i class="fas fa-user"></i> ${user.name || user.username}</span>
            <button onclick="logout()" class="btn-logout"><i class="fas fa-sign-out-alt"></i> Sair</button>
        `;
        
        // Inserir no header
        const header = document.querySelector('header');
        if (header) {
            header.appendChild(userInfo);
        }
    });
})();

function logout() {
    if (confirm('Deseja realmente sair?')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
}

// Função para fazer requisições autenticadas
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('auth_token');
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error('Sessão expirada');
    }
    
    return response;
}