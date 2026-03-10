const API_URL = 'http://localhost:3000/api';

window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        verifyToken(token);
    }
    
    const rememberedUser = localStorage.getItem('remember_user');
    if (rememberedUser) {
        document.getElementById('username').value = rememberedUser;
        document.getElementById('remember').checked = true;
    }
});

async function verifyToken(token) {
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            window.location.href = 'index.html';
        } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
        }
    } catch (error) {
        console.error('Erro ao verificar token:', error);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    const errorDiv = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');
    
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<span class="loading"></span> Entrando...';
    loginBtn.disabled = true;
    errorDiv.classList.remove('show');
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao fazer login');
        }
        
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        if (remember) {
            localStorage.setItem('remember_user', username);
        } else {
            localStorage.removeItem('remember_user');
        }
        
        window.location.href = 'index.html';
        
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

function togglePassword() {
    const input = document.getElementById('password');
    const icon = document.querySelector('.toggle-password i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function forgotPassword() {
    alert('Entre em contato com o administrador do sistema.\n\nUsuário padrão: admin\nSenha padrão: admin123');
}