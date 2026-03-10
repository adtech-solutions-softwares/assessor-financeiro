const API_URL = 'http://localhost:3000/api';
let transactions = [];
let goals = [];
let categories = [];
let currentSort = { field: 'date', direction: 'desc' };
let expenseChartInstance = null;
let trendChartInstance = null;
let typeChartInstance = null;

document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.name || user.username || 'Usuário';
    document.getElementById('userInfo').style.display = 'flex';
    
    document.querySelectorAll('.currency-input').forEach(input => {
        input.addEventListener('input', maskCurrency);
        input.addEventListener('blur', maskCurrency);
    });
    
    document.getElementById('transDate').valueAsDate = new Date();
    
    await loadData();
});

function logout() {
    if (confirm('Deseja realmente sair?')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
}

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
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        throw new Error('Sessão expirada');
    }
    
    return response;
}

async function loadData() {
    try {
        updateConnectionStatus(true);
        
        const [transRes, goalsRes, catRes] = await Promise.all([
            authFetch(`${API_URL}/transactions`),
            authFetch(`${API_URL}/goals`),
            authFetch(`${API_URL}/categories`)
        ]);

        transactions = await transRes.json();
        goals = await goalsRes.json();
        categories = await catRes.json();

        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
        localStorage.setItem('backup_goals', JSON.stringify(goals));
        localStorage.setItem('backup_categories', JSON.stringify(categories));

        updateDashboard();
        renderTransactions();
        renderGoals();
        populateFilters();
        renderCategoryManager();
        
        showNotification('Dados carregados!');
    } catch (error) {
        console.error('Erro:', error);
        updateConnectionStatus(false);
        
        transactions = JSON.parse(localStorage.getItem('backup_transactions')) || [];
        goals = JSON.parse(localStorage.getItem('backup_goals')) || [];
        categories = JSON.parse(localStorage.getItem('backup_categories')) || [];
        
        updateDashboard();
        renderTransactions();
        renderGoals();
        populateFilters();
        renderCategoryManager();
        
        showNotification('Usando dados locais', 'warning');
    }
}

function renderCategoryManager() {
    const container = document.getElementById('categoryListManager');
    
    if (categories.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma categoria</p>';
        return;
    }
    
    container.innerHTML = categories.map(cat => `
        <div class="category-tag" style="background: ${cat.color}">
            ${cat.name}
            <button onclick="deleteCategory(${cat.id})" title="Excluir">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

async function addCategory(e) {
    e.preventDefault();
    
    const name = document.getElementById('newCategoryName').value;
    const type = document.getElementById('newCategoryType').value;
    const color = document.getElementById('newCategoryColor').value;
    
    try {
        const response = await authFetch(`${API_URL}/categories`, {
            method: 'POST',
            body: JSON.stringify({ name, type, color })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao criar categoria');
        }
        
        const newCat = await response.json();
        categories.push(newCat);
        renderCategoryManager();
        populateFilters();
        
        document.getElementById('newCategoryName').value = '';
        showNotification('Categoria criada!');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deleteCategory(id) {
    if (!confirm('Deseja excluir esta categoria?')) return;
    
    try {
        const response = await authFetch(`${API_URL}/categories/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao excluir');
        }
        
        categories = categories.filter(c => c.id !== id);
        renderCategoryManager();
        populateFilters();
        showNotification('Categoria excluída!');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function exportData(format) {
    try {
        if (format === 'csv') {
            const response = await authFetch(`${API_URL}/export?format=csv`);
            const blob = await response.blob();
            downloadFile(blob, 'transacoes.csv');
        } else if (format === 'excel') {
            const data = transactions.map(t => ({
                Data: formatDateDisplay(t.date),
                Descrição: t.description,
                Categoria: t.category,
                Tipo: getTypeLabel(t.type),
                Valor: formatCurrency(t.amount)
            }));
            
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Transações");
            XLSX.writeFile(wb, "transacoes.xlsx");
        }
        
        showNotification('Dados exportados com sucesso!');
    } catch (error) {
        showNotification('Erro ao exportar: ' + error.message, 'error');
    }
}

function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function maskCurrency(e) {
    let value = e.target.value;
    value = value.replace(/[^\d,]/g, '');
    value = value.replace(/\./g, ',');
    
    const parts = value.split(',');
    if (parts.length > 2) {
        value = parts[0] + ',' + parts.slice(1).join('');
    }
    
    if (value) {
        let integer = parts[0];
        let decimal = parts[1] || '';
        decimal = decimal.substring(0, 2);
        integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        value = decimal ? `${integer},${decimal}` : integer;
    }
    
    e.target.value = value ? 'R$ ' + value : '';
}

function parseCurrency(value) {
    if (!value) return 0;
    return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function populateFilters() {
    const years = [...new Set(transactions.map(t => t.date.substring(0, 4)))].sort().reverse();
    const yearSelect = document.getElementById('filterYear');
    yearSelect.innerHTML = '<option value="">Todos</option>' + 
        years.map(year => `<option value="${year}">${year}</option>`).join('');

    const catSelect = document.getElementById('filterCategory');
    const transCatSelect = document.getElementById('transCategory');
    
    const catOptions = categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    
    catSelect.innerHTML = '<option value="">Todas</option>' + catOptions;
    transCatSelect.innerHTML = catOptions;
}

function applyFilters() {
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const month = document.getElementById('filterMonth').value;
    const year = document.getElementById('filterYear').value;
    const category = document.getElementById('filterCategory').value;
    const type = document.getElementById('filterType').value;
    const search = document.getElementById('filterSearch').value.toLowerCase();

    let filtered = transactions.filter(t => {
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        if (month && t.date.substring(5, 7) !== month) return false;
        if (year && !t.date.startsWith(year)) return false;
        if (category && t.category !== category) return false;
        if (type && t.type !== type) return false;
        if (search && !t.description.toLowerCase().includes(search)) return false;
        return true;
    });

    filtered.sort((a, b) => {
        let valA = a[currentSort.field];
        let valB = b[currentSort.field];
        
        if (currentSort.field === 'amount') {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        }
        
        if (currentSort.direction === 'asc') {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }
    });

    renderTransactionsTable(filtered);
    updateActiveFilters({ dateFrom, dateTo, month, year, category, type, search });
}

function renderTransactionsTable(data) {
    const tbody = document.getElementById('transactionsBody');
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhuma transação encontrada</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map(t => `
        <tr class="${t.type === 'income' ? '' : t.type === 'fixed' ? 'cell-fixed' : 'cell-variable'}">
            <td>${formatDateDisplay(t.date)}</td>
            <td>${t.description}</td>
            <td>${t.category}</td>
            <td class="${t.type === 'income' ? 'cell-income' : 'cell-expense'}">
                ${getTypeLabel(t.type)}
            </td>
            <td class="${t.type === 'income' ? 'cell-income' : 'cell-expense'}">
                ${formatCurrency(t.amount)}
            </td>
            <td>
                <button class="delete-btn" onclick="deleteTransaction('${t.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateActiveFilters(filters) {
    const container = document.getElementById('activeFilters');
    const tags = [];
    
    if (filters.dateFrom) tags.push({ label: `De: ${formatDateDisplay(filters.dateFrom)}`, key: 'dateFrom' });
    if (filters.dateTo) tags.push({ label: `Até: ${formatDateDisplay(filters.dateTo)}`, key: 'dateTo' });
    if (filters.month) tags.push({ label: `Mês: ${getMonthName(filters.month)}`, key: 'month' });
    if (filters.year) tags.push({ label: `Ano: ${filters.year}`, key: 'year' });
    if (filters.category) tags.push({ label: `Cat: ${filters.category}`, key: 'category' });
    if (filters.type) tags.push({ label: `Tipo: ${getTypeLabel(filters.type)}`, key: 'type' });
    if (filters.search) tags.push({ label: `Busca: ${filters.search}`, key: 'search' });

    container.innerHTML = tags.map(tag => `
        <span class="filter-tag" onclick="removeFilter('${tag.key}')">
            ${tag.label} <i class="fas fa-times"></i>
        </span>
    `).join('');
}

function removeFilter(key) {
    const elementId = 'filter' + key.charAt(0).toUpperCase() + key.slice(1);
    const element = document.getElementById(elementId);
    if (element) element.value = '';
    applyFilters();
}

function clearFilters() {
    document.querySelectorAll('.filter-input, .filter-select').forEach(el => el.value = '');
    applyFilters();
}

function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'desc';
    }
    applyFilters();
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) await processFile(file);
}

async function processFile(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            let data;
            
            if (file.name.endsWith('.csv')) {
                const text = e.target.result;
                data = parseCSV(text);
            } else {
                const data_array = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data_array, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                data = XLSX.utils.sheet_to_json(firstSheet);
            }

            await importTransactions(data);
        } catch (error) {
            showNotification('Erro ao processar: ' + error.message, 'error');
        }
    };
    
    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const obj = {};
        
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        
        result.push(obj);
    }
    
    return result;
}

async function importTransactions(data) {
    let imported = 0;
    
    for (const row of data) {
        const date = parseDate(row.Data || row.data || row.DATE);
        const desc = row.Descrição || row.descricao || row.DESCRIÇAO || row.description;
        const cat = row.Categoria || row.categoria || row.CATEGORIA || row.category;
        const type = parseType(row.Tipo || row.tipo || row.TIPO || row.type);
        const value = parseValue(row.Valor || row.valor || row.VALOR || row.value);

        if (date && desc && value) {
            const transaction = {
                date: date,
                description: desc,
                category: cat || 'Outros',
                type: type,
                amount: value
            };
            
            await saveTransaction(transaction);
            imported++;
        }
    }
    
    applyFilters();
    updateDashboard();
    showNotification(`${imported} transações importadas!`);
    switchTab('transactions');
}

function parseDate(dateValue) {
    if (!dateValue) return null;
    
    if (typeof dateValue === 'number') {
        const epoch = new Date(1899, 11, 30);
        const fixedDate = new Date(epoch.getTime() + dateValue * 86400000);
        return fixedDate.toISOString().split('T')[0];
    }
    
    const str = dateValue.toString().trim();
    
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            return `${year}-${month}-${day}`;
        }
    }
    
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return str;
    }
    
    return null;
}

function parseType(typeValue) {
    if (!typeValue) return 'variable';
    const type = typeValue.toString().toLowerCase();
    
    if (type.includes('receita') || type.includes('renda') || type.includes('income')) return 'income';
    if (type.includes('fixa') || type.includes('fixed')) return 'fixed';
    return 'variable';
}

function parseValue(value) {
    if (!value) return 0;
    
    let str = value.toString();
    str = str.replace(/[R$\s]/g, '');
    
    if (str.includes(',') && str.includes('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    
    return parseFloat(str) || 0;
}

async function saveTransaction(transaction) {
    try {
        const response = await authFetch(`${API_URL}/transactions`, {
            method: 'POST',
            body: JSON.stringify(transaction)
        });
        
        if (!response.ok) throw new Error('Erro ao salvar');
        
        const saved = await response.json();
        transactions.push(saved);
        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
        
        return saved;
    } catch (error) {
        transaction.id = 'local_' + Date.now();
        transactions.push(transaction);
        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
        showNotification('Salvo localmente', 'warning');
        return transaction;
    }
}

async function addTransaction(e) {
    e.preventDefault();
    
    const transaction = {
        date: document.getElementById('transDate').value,
        description: document.getElementById('transDesc').value,
        category: document.getElementById('transCategory').value,
        type: document.getElementById('transType').value,
        amount: parseCurrency(document.getElementById('transAmount').value)
    };
    
    await saveTransaction(transaction);
    
    closeModal();
    applyFilters();
    updateDashboard();
    showNotification('Transação salva!');
    e.target.reset();
    document.getElementById('transDate').valueAsDate = new Date();
}

async function deleteTransaction(id) {
    if (!confirm('Deseja realmente excluir esta transação?')) return;
    
    try {
        await authFetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' });
        transactions = transactions.filter(t => t.id != id);
        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
    } catch (error) {
        transactions = transactions.filter(t => t.id != id);
        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
    }
    
    applyFilters();
    updateDashboard();
    showNotification('Transação excluída!');
}

function updateDashboard() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthly = transactions.filter(t => t.date.startsWith(currentMonth));
    
    const income = monthly.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expenses = monthly.filter(t => t.type !== 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
    const balance = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income * 100) : 0;

    document.getElementById('totalBalance').textContent = formatCurrency(balance);
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpense').textContent = formatCurrency(expenses);
    document.getElementById('savingsRate').textContent = savingsRate.toFixed(1) + '%';
    document.getElementById('savingsProgress').style.width = Math.max(0, Math.min(100, savingsRate)) + '%';

    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysRemaining = lastDay.getDate() - today.getDate() + 1;
    
    const daily = balance > 0 ? balance / daysRemaining : 0;
    
    document.getElementById('dailyLimit').textContent = formatCurrency(daily);
    document.getElementById('weeklyLimit').textContent = formatCurrency(daily * 7);
    document.getElementById('monthlyLimit').textContent = formatCurrency(balance);

    const tip = document.getElementById('financialTip');
    if (balance < 0) {
        tip.innerHTML = '<strong style="color: var(--danger);">Atenção:</strong> Gastos maiores que receitas!';
    } else if (savingsRate < 10) {
        tip.innerHTML = '<strong style="color: var(--warning);">Dica:</strong> Tente economizar pelo menos 10%.';
    } else {
        tip.innerHTML = '<strong style="color: var(--success);">Parabéns!</strong> Finanças equilibradas.';
    }

    updateCharts();
}

function updateCharts() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const cats = {};
    
    transactions.filter(t => t.type !== 'income').forEach(t => {
        cats[t.category] = (cats[t.category] || 0) + parseFloat(t.amount);
    });

    if (expenseChartInstance) expenseChartInstance.destroy();
    
    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{
                data: Object.values(cats),
                backgroundColor: generateColors(Object.keys(cats).length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#f8fafc' } }
            }
        }
    });

    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const list = document.getElementById('topCategories');
    
    if (sorted.length === 0) {
        list.innerHTML = '<li class="empty-state"><i class="fas fa-inbox"></i><p>Sem dados</p></li>';
    } else {
        const colors = generateColors(sorted.length);
        list.innerHTML = sorted.map((item, i) => `
            <li class="category-item">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${colors[i]}"></div>
                    <span>${item[0]}</span>
                </div>
                <span style="font-weight: 700; color: var(--danger);">${formatCurrency(item[1])}</span>
            </li>
        `).join('');
    }
}

async function addGoal(e) {
    e.preventDefault();
    
    const goal = {
        name: document.getElementById('goalName').value,
        targetAmount: parseCurrency(document.getElementById('goalAmount').value),
        term: document.getElementById('goalTerm').value,
        monthlySaving: parseCurrency(document.getElementById('goalMonthly').value),
        currentAmount: 0,
        createdAt: new Date().toISOString()
    };

    try {
        const response = await authFetch(`${API_URL}/goals`, {
            method: 'POST',
            body: JSON.stringify(goal)
        });
        
        const saved = await response.json();
        goals.push(saved);
        localStorage.setItem('backup_goals', JSON.stringify(goals));
    } catch (error) {
        goal.id = 'local_' + Date.now();
        goals.push(goal);
        localStorage.setItem('backup_goals', JSON.stringify(goals));
    }

    renderGoals();
    showNotification('Meta criada!');
    e.target.reset();
}

function renderGoals() {
    const container = document.getElementById('goalsContainer');
    
    if (goals.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i class="fas fa-bullseye"></i><p>Nenhuma meta</p></div>';
        return;
    }

    const terms = {
        short: { label: 'Curto Prazo', class: 'goal-short' },
        medium: { label: 'Médio Prazo', class: 'goal-medium' },
        long: { label: 'Longo Prazo', class: 'goal-long' }
    };

    container.innerHTML = goals.map(g => {
        const progress = (g.currentAmount / g.targetAmount * 100).toFixed(1);
        const months = Math.ceil((g.targetAmount - g.currentAmount) / g.monthlySaving);
        const term = terms[g.term];
        
        return `
            <div class="goal-card ${term.class}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 1.3rem; font-weight: 700;">${g.name}</div>
                        <span style="font-size: 0.8rem; padding: 4px 12px; border-radius: 20px; background: rgba(255,255,255,0.1);">${term.label}</span>
                    </div>
                    <button class="delete-btn" onclick="deleteGoal('${g.id}')"><i class="fas fa-trash"></i></button>
                </div>
                <div style="font-size: 1.8rem; font-weight: 800; color: var(--primary); margin: 15px 0;">${formatCurrency(g.targetAmount)}</div>
                <div style="margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.9rem;">
                        <span>Progresso: ${formatCurrency(g.currentAmount)}</span>
                        <span>${progress}%</span>
                    </div>
                    <div class="progress-bar"><div class="progress-fill" style="width: ${Math.min(100, progress)}%"></div></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; font-size: 0.9rem; color: var(--text-muted);">
                    <div><i class="fas fa-calendar-alt"></i> ${months} meses</div>
                    <div><i class="fas fa-coins"></i> ${formatCurrency(g.monthlySaving)}/mês</div>
                </div>
                <button class="btn btn-primary" style="width: 100%; margin-top: 15px;" onclick="addToGoal('${g.id}')">
                    <i class="fas fa-plus"></i> Adicionar Economia
                </button>
            </div>
        `;
    }).join('');
}

async function deleteGoal(id) {
    if (!confirm('Excluir meta?')) return;
    
    try {
        await authFetch(`${API_URL}/goals/${id}`, { method: 'DELETE' });
    } catch (e) {}
    
    goals = goals.filter(g => g.id != id);
    localStorage.setItem('backup_goals', JSON.stringify(goals));
    renderGoals();
    showNotification('Meta excluída!');
}

async function addToGoal(id) {
    const amount = prompt('Valor a adicionar (R$):');
    if (!amount) return;
    
    const val = parseCurrency(amount);
    const goal = goals.find(g => g.id == id);
    if (goal) {
        goal.currentAmount += val;
        
        try {
            await authFetch(`${API_URL}/goals/${id}`, {
                method: 'PUT',
                body: JSON.stringify(goal)
            });
        } catch (e) {}
        
        localStorage.setItem('backup_goals', JSON.stringify(goals));
        renderGoals();
        showNotification('Economia adicionada!');
    }
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function getMonthName(num) {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return months[parseInt(num) - 1];
}

function getTypeLabel(type) {
    const labels = { income: 'Receita', fixed: 'Fixa', variable: 'Variável' };
    return labels[type] || type;
}

function generateColors(count) {
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return Array(count).fill(0).map((_, i) => colors[i % colors.length]);
}

function updateConnectionStatus(online) {
    const status = document.getElementById('connectionStatus');
    status.className = 'connection-status ' + (online ? 'online' : 'offline');
    status.innerHTML = `<i class="fas fa-circle"></i> <span>${online ? 'Online' : 'Offline'}</span>`;
}

function showNotification(msg, type = 'success') {
    const notif = document.getElementById('notification');
    const text = document.getElementById('notificationText');
    text.textContent = msg;
    notif.style.background = type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--success)';
    notif.style.display = 'flex';
    setTimeout(() => notif.style.display = 'none', 3000);
}

function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.target.closest('.tab').classList.add('active');
    document.getElementById(name).classList.add('active');
}

function openModal() { document.getElementById('transactionModal').classList.add('active'); }
function closeModal() { document.getElementById('transactionModal').classList.remove('active'); }

function downloadTemplate() {
    const template = [
        { Data: '01/03/2024', Descrição: 'Salário', Categoria: 'Renda', Tipo: 'Receita', Valor: '5000,00' },
        { Data: '05/03/2024', Descrição: 'Aluguel', Categoria: 'Moradia', Tipo: 'Fixa', Valor: '1200,00' },
        { Data: '10/03/2024', Descrição: 'Supermercado', Categoria: 'Alimentação', Tipo: 'Variável', Valor: '450,00' }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_financeiro.xlsx");
}

function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('dragover'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('dragover'); }
function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
}

function renderTransactions() {
    applyFilters();
}

window.onclick = function(e) {
    if (e.target.classList.contains('modal')) closeModal();
}