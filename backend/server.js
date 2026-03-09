const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { authenticateToken, generateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Inicializar db.json com usuário admin
function initDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [
                {
                    id: '1',
                    username: 'admin',
                    password: bcrypt.hashSync('admin123', 10),
                    name: 'Administrador',
                    role: 'admin',
                    createdAt: new Date().toISOString()
                }
            ],
            transactions: [],
            goals: [],
            categories: [
                { id: 1, name: 'Alimentação', type: 'expense', color: '#ef4444' },
                { id: 2, name: 'Moradia', type: 'expense', color: '#f59e0b' },
                { id: 3, name: 'Transporte', type: 'expense', color: '#3b82f6' },
                { id: 4, name: 'Saúde', type: 'expense', color: '#10b981' },
                { id: 5, name: 'Educação', type: 'expense', color: '#8b5cf6' },
                { id: 6, name: 'Lazer', type: 'expense', color: '#ec4899' },
                { id: 7, name: 'Vestuário', type: 'expense', color: '#14b8a6' },
                { id: 8, name: 'Serviços', type: 'expense', color: '#f97316' },
                { id: 9, name: 'Cartão Crédito', type: 'expense', color: '#6366f1' },
                { id: 10, name: 'Emergência', type: 'expense', color: '#dc2626' },
                { id: 11, name: 'Pessoal', type: 'expense', color: '#84cc16' },
                { id: 12, name: 'Impostos', type: 'expense', color: '#64748b' },
                { id: 13, name: 'Telefone', type: 'expense', color: '#0ea5e9' },
                { id: 14, name: 'Trabalho', type: 'expense', color: '#a855f7' },
                { id: 15, name: 'Renda', type: 'income', color: '#10b981' },
                { id: 16, name: 'Outros', type: 'expense', color: '#94a3b8' }
            ]
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        console.log('✅ Banco de dados criado com usuário admin');
        console.log('👤 Usuário: admin');
        console.log('🔑 Senha: admin123');
    }
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ===== ROTAS DE AUTENTICAÇÃO =====

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    
    const user = db.users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: 'Senha incorreta' });
    }

    const token = generateToken(user);
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        }
    });
});

// Verificar token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Criar usuário (apenas admin)
app.post('/api/auth/register', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem criar usuários' });
    }

    const { username, password, name, role = 'user' } = req.body;
    const db = readDB();

    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Usuário já existe' });
    }

    const newUser = {
        id: Date.now().toString(),
        username,
        password: bcrypt.hashSync(password, 10),
        name,
        role,
        createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDB(db);

    res.status(201).json({
        message: 'Usuário criado com sucesso',
        user: { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role }
    });
});

// ===== ROTAS PROTEGIDAS =====

// Categorias
app.get('/api/categories', authenticateToken, (req, res) => {
    const db = readDB();
    res.json(db.categories);
});

app.post('/api/categories', authenticateToken, (req, res) => {
    const db = readDB();
    const { name, type, color } = req.body;
    
    if (db.categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ error: 'Categoria já existe' });
    }

    const newCategory = {
        id: Date.now(),
        name,
        type: type || 'expense',
        color: color || '#6366f1'
    };
    
    db.categories.push(newCategory);
    writeDB(db);
    res.status(201).json(newCategory);
});

app.delete('/api/categories/:id', authenticateToken, (req, res) => {
    const db = readDB();
    const categoryId = parseInt(req.params.id);
    
    // Verificar se há transações usando esta categoria
    const hasTransactions = db.transactions.some(t => t.category === db.categories.find(c => c.id === categoryId)?.name);
    if (hasTransactions) {
        return res.status(400).json({ error: 'Não pode excluir categoria em uso' });
    }
    
    db.categories = db.categories.filter(c => c.id !== categoryId);
    writeDB(db);
    res.status(204).send();
});

// Transações
app.get('/api/transactions', authenticateToken, (req, res) => {
    const db = readDB();
    res.json(db.transactions);
});

app.post('/api/transactions', authenticateToken, (req, res) => {
    const db = readDB();
    const transaction = {
        id: Date.now().toString(),
        ...req.body,
        userId: req.user.id,
        createdAt: new Date().toISOString()
    };
    db.transactions.push(transaction);
    writeDB(db);
    res.status(201).json(transaction);
});

app.put('/api/transactions/:id', authenticateToken, (req, res) => {
    const db = readDB();
    const index = db.transactions.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    
    db.transactions[index] = { ...db.transactions[index], ...req.body, updatedAt: new Date().toISOString() };
    writeDB(db);
    res.json(db.transactions[index]);
});

app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
    const db = readDB();
    db.transactions = db.transactions.filter(t => t.id !== req.params.id);
    writeDB(db);
    res.status(204).send();
});

// Metas
app.get('/api/goals', authenticateToken, (req, res) => {
    const db = readDB();
    res.json(db.goals);
});

app.post('/api/goals', authenticateToken, (req, res) => {
    const db = readDB();
    const goal = {
        id: Date.now().toString(),
        ...req.body,
        userId: req.user.id,
        createdAt: new Date().toISOString()
    };
    db.goals.push(goal);
    writeDB(db);
    res.status(201).json(goal);
});

app.put('/api/goals/:id', authenticateToken, (req, res) => {
    const db = readDB();
    const index = db.goals.findIndex(g => g.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    
    db.goals[index] = { ...db.goals[index], ...req.body, updatedAt: new Date().toISOString() };
    writeDB(db);
    res.json(db.goals[index]);
});

app.delete('/api/goals/:id', authenticateToken, (req, res) => {
    const db = readDB();
    db.goals = db.goals.filter(g => g.id !== req.params.id);
    writeDB(db);
    res.status(204).send();
});

// Exportar dados para Excel/CSV
app.get('/api/export', authenticateToken, (req, res) => {
    const db = readDB();
    const format = req.query.format || 'json';
    
    if (format === 'csv') {
        let csv = 'Data,Descrição,Categoria,Tipo,Valor\n';
        db.transactions.forEach(t => {
            const date = formatDateBR(t.date);
            const type = t.type === 'income' ? 'Receita' : t.type === 'fixed' ? 'Fixa' : 'Variável';
            csv += `"${date}","${t.description}","${t.category}","${type}","${formatCurrency(t.amount)}"\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=transacoes.csv');
        return res.send(csv);
    }
    
    res.json({
        transactions: db.transactions,
        goals: db.goals,
        categories: db.categories,
        exportedAt: new Date().toISOString()
    });
});

function formatDateBR(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

// Inicializar e iniciar
initDB();
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📁 Banco de dados: ${DB_FILE}`);
    console.log(`🔐 Login: http://localhost:${PORT}/login.html`);
});