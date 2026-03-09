const API_URL = 'http://localhost:3000/api';

// Verificar se já está logado
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        verifyToken(token);
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
        
        // Salvar token
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        if (remember) {
            localStorage.setItem('remember_user', username);
        } else {
            localStorage.removeItem('remember_user');
        }
        
        // Redirecionar
        window.location.href = 'index.html';
        
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
        
        setTimeout(() => {
            errorDiv.classList.remove('show');
        }, 5000);
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
    alert('Entre em contato com o administrador do sistema para redefinir sua senha.\n\nUsuário padrão: admin\nSenha padrão: admin123');
}

// Preencher usuário salvo
const rememberedUser = localStorage.getItem('remember_user');
if (rememberedUser) {
    document.getElementById('username').value = rememberedUser;
    document.getElementById('remember').checked = true;
}