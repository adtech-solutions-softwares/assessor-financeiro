const API_URL = 'http://localhost:3000/api';
let transactions = [];
let goals = [];
let categories = [];
let currentSort = { field: 'date', direction: 'desc' };
let expenseChartInstance = null;
let trendChartInstance = null;
let typeChartInstance = null;

document.addEventListener('DOMContentLoaded', async function() {
    document.getElementById('transDate').valueAsDate = new Date();
    
    document.querySelectorAll('.currency-input').forEach(input => {
        input.addEventListener('input', maskCurrency);
        input.addEventListener('blur', maskCurrency);
    });

    await loadData();
    updateDashboard();
    renderTransactionsTable();
    renderGoals();
    populateFilters();
    renderCategoryManager();
    
});

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
        loadCategories(categories);
        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
        localStorage.setItem('backup_goals', JSON.stringify(goals));
        localStorage.setItem('backup_categories', JSON.stringify(categories));

        showNotification('Dados carregados do servidor!');
    } catch (error) {
        console.error('Erro:', error);
        updateConnectionStatus(false);
        
        transactions = JSON.parse(localStorage.getItem('backup_transactions')) || [];
        goals = JSON.parse(localStorage.getItem('backup_goals')) || [];
        categories = JSON.parse(localStorage.getItem('backup_categories')) || [];
        
        showNotification('Usando dados locais (modo offline)', 'warning');
    }
}

// Categorias
function renderCategoryManager() {
    const container = document.getElementById('categoryListManager');
    container.innerHTML = categories.map(cat => `
        <div class="category-tag" style="background: ${cat.color}">
            ${cat.name}
            <button onclick="deleteCategory(${cat.id})" title="Excluir">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

async function loadCategories(categories) {
    try {
        const select = document.getElementById("transCategory");

        select.innerHTML = '<option value="">Selecione...</option>';

        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao carregar categorias:", error);
    }
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
        
        if (!response.ok) throw new Error('Erro ao criar categoria');
        
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
        
        if (!response.ok) throw new Error('Não pode excluir categoria em uso');
        
        categories = categories.filter(c => c.id !== id);
        renderCategoryManager();
        populateFilters();
        showNotification('Categoria excluída!');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Exportação
async function exportData(format) {
    try {
        if (format === 'csv') {
            const response = await authFetch(`${API_URL}/export?format=csv`);
            const blob = await response.blob();
            downloadFile(blob, 'transacoes.csv');
        } else if (format === 'excel') {
            // Criar workbook do lado do cliente
            const data = transactions.map(t => ({
                Data: formatDate(t.date),
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

// ... (restante do código mantido igual: saveTransaction, deleteTransaction,
//  maskCurrency, parseCurrency, formatCurrency, populateFilters, applyFilters, renderTransactionsTable, etc.)
// Dashboard e Analytics
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

    // Limites
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysRemaining = lastDay.getDate() - today.getDate() + 1;
    
    const daily = balance > 0 ? balance / daysRemaining : 0;
    
    document.getElementById('dailyLimit').textContent = formatCurrency(daily);
    document.getElementById('weeklyLimit').textContent = formatCurrency(daily * 7);
    document.getElementById('monthlyLimit').textContent = formatCurrency(balance);

    // Dica
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
    // Gráfico de categorias
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

    // Top categorias lista
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


// Salvar transação
async function saveTransaction(transaction) {
    try {
        const response = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });
        
        if (!response.ok) throw new Error('Erro ao salvar');
        
        const saved = await response.json();
        transactions.push(saved);
        
        // Atualizar backup local
        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
        updateConnectionStatus(true);
        
        return saved;
    } catch (error) {
        console.error('Erro:', error);
        updateConnectionStatus(false);
        
        // Salvar localmente com ID temporário
        transaction.id = 'local_' + Date.now();
        transactions.push(transaction);
        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
        
        showNotification('Salvo localmente (servidor indisponível)', 'warning');
        return transaction;
    }
}

// Excluir transação
async function deleteTransaction(id) {
    if (!confirm('Deseja excluir esta transação?')) return;
    
    try {
        await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' });
        transactions = transactions.filter(t => t.id != id);
        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
        updateConnectionStatus(true);
    } catch (error) {
        updateConnectionStatus(false);
        transactions = transactions.filter(t => t.id != id);
        localStorage.setItem('backup_transactions', JSON.stringify(transactions));
    }
    
    applyFilters();
    updateDashboard();
    showNotification('Transação excluída!');
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
                <div class="goal-header" style="display: flex; justify-content: space-between; margin-bottom: 15px;">
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
        await fetch(`${API_URL}/goals/${id}`, { method: 'DELETE' });
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
            await fetch(`${API_URL}/goals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goal)
            });
        } catch (e) {}
        
        localStorage.setItem('backup_goals', JSON.stringify(goals));
        renderGoals();
        showNotification('Economia adicionada!');
    }
}
    

// Converter valor monetário para número
function parseCurrency(value) {
    if (!value) return 0;
    return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

// Formatar para exibição
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

// Popular filtros dinâmicos
function populateFilters() {
    // Anos únicos
    const years = [...new Set(transactions.map(t => t.date.substring(0, 4)))].sort().reverse();
    const yearSelect = document.getElementById('filterYear');
    years.forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    });

    // Categorias
    const catSelect = document.getElementById('filterCategory');
    const transCatSelect = document.getElementById('transCategory');
    
    categories.forEach(cat => {
        catSelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
        transCatSelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });
}

// Aplicar filtros
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

    // Ordenação
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
            <td>${formatDate(t.date)}</td>
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
    
    if (filters.dateFrom) tags.push({ label: `De: ${formatDate(filters.dateFrom)}`, key: 'dateFrom' });
    if (filters.dateTo) tags.push({ label: `Até: ${formatDate(filters.dateTo)}`, key: 'dateTo' });
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
    document.getElementById('filter' + key.charAt(0).toUpperCase() + key.slice(1)).value = '';
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

// Funções utilitárias mantidas
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function getTypeLabel(type) {
    const labels = { income: 'Receita', fixed: 'Fixa', variable: 'Variável' };
    return labels[type] || type;
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

window.onclick = function(e) {
    if (e.target.classList.contains('modal')) closeModal();
}

function maskCurrency(e) {
    let value = e.target.value;

    value = value.replace(/\D/g, ""); // remove tudo que não é número
    value = (value / 100).toFixed(2) + "";
    value = value.replace(".", ",");

    value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    e.target.value = "R$ " + value;
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

function generateColors(count) {
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return Array(count).fill(0).map((_, i) => colors[i % colors.length]);
}
    