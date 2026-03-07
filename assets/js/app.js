// Data Storage
let transactions = JSON.parse(localStorage.getItem('financial_transactions')) || [];
let goals = JSON.parse(localStorage.getItem('financial_goals')) || [];
let expenseChartInstance = null;
let trendChartInstance = null;
let typeChartInstance = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('transDate').valueAsDate = new Date();
    updateDashboard();
    renderTransactions();
    renderGoals();
});

// Tab Switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.closest('.tab').classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'dashboard') updateDashboard();
    if (tabName === 'analytics') updateAnalytics();
}

// File Upload Handling
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length) processFile(files[0]);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            importTransactions(jsonData);
        } catch (error) {
            showNotification('Erro ao processar arquivo: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function importTransactions(data) {
    let imported = 0;
    data.forEach(row => {
        const date = row.Data || row.data || row.Date || row.date;
        const desc = row.Descrição || row.descricao || row.Description || row.description || row.desc;
        const cat = row.Categoria || row.categoria || row.Category || row.category;
        const type = row.Tipo || row.tipo || row.Type || row.type;
        const value = row.Valor || row.valor || row.Value || row.value || row.amount;
        
        if (date && desc && value) {
            const transaction = {
                id: Date.now() + Math.random(),
                date: formatDate(date),
                description: desc,
                category: cat || 'Outros',
                type: detectType(type, value),
                amount: Math.abs(parseFloat(value.toString().replace(/[R$\s.]/g, '').replace(',', '.')))
            };
            transactions.push(transaction);
            imported++;
        }
    });
    
    saveData();
    updateDashboard();
    renderTransactions();
    showNotification(`${imported} transações importadas com sucesso!`);
    switchTab('dashboard');
}

function formatDate(dateValue) {
    if (typeof dateValue === 'number') {
        const epoch = new Date(1899, 11, 30);
        const fixedDate = new Date(epoch.getTime() + dateValue * 86400000);
        return fixedDate.toISOString().split('T')[0];
    }
    const str = dateValue.toString();
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return new Date().toISOString().split('T')[0];
}

function detectType(typeValue, amountValue) {
    if (!typeValue) return parseFloat(amountValue) > 0 ? 'income' : 'variable';
    const type = typeValue.toString().toLowerCase();
    if (type.includes('receita') || type.includes('renda') || type.includes('income')) return 'income';
    if (type.includes('fixa') || type.includes('fixed')) return 'fixed';
    return 'variable';
}

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

// Transaction Management
function openModal() {
    document.getElementById('transactionModal').classList.add('active');
}

function closeModal() {
    document.getElementById('transactionModal').classList.remove('active');
}

function addTransaction(e) {
    e.preventDefault();
    const transaction = {
        id: Date.now(),
        date: document.getElementById('transDate').value,
        description: document.getElementById('transDesc').value,
        category: document.getElementById('transCategory').value,
        type: document.getElementById('transType').value,
        amount: parseFloat(document.getElementById('transAmount').value)
    };
    
    transactions.push(transaction);
    saveData();
    updateDashboard();
    renderTransactions();
    closeModal();
    showNotification('Transação adicionada com sucesso!');
    e.target.reset();
    document.getElementById('transDate').valueAsDate = new Date();
}

function deleteTransaction(id) {
    if (confirm('Deseja realmente excluir esta transação?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        updateDashboard();
        renderTransactions();
        showNotification('Transação excluída!');
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    if (transactions.length === 0) {
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
    
    tbody.innerHTML = transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(t => `
            <tr>
                <td>${formatDisplayDate(t.date)}</td>
                <td>${t.description}</td>
                <td>${t.category}</td>
                <td><span class="badge badge-${t.type === 'income' ? 'income' : t.type === 'fixed' ? 'fixed' : 'variable'}">${getTypeLabel(t.type)}</span></td>
                <td class="amount ${t.type === 'income' ? 'positive' : 'negative'}">${formatCurrency(t.amount)}</td>
                <td><button class="delete-btn" onclick="deleteTransaction(${t.id})"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
}

function getTypeLabel(type) {
    const labels = { income: 'Receita', fixed: 'Fixa', variable: 'Variável' };
    return labels[type] || type;
}

// Dashboard Calculations
function updateDashboard() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyTransactions = transactions.filter(t => t.date.startsWith(currentMonth));
    
    const income = monthlyTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = monthlyTransactions
        .filter(t => t.type !== 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
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
    
    const dailyLimit = balance > 0 ? balance / daysRemaining : 0;
    const weeklyLimit = dailyLimit * 7;
    
    document.getElementById('dailyLimit').textContent = formatCurrency(dailyLimit);
    document.getElementById('weeklyLimit').textContent = formatCurrency(weeklyLimit);
    document.getElementById('monthlyLimit').textContent = formatCurrency(balance);
    
    updateFinancialTip(balance, savingsRate, expenses, income);
    updateCharts();
    updateTopCategories();
}

function updateFinancialTip(balance, savingsRate, expenses, income) {
    const tipElement = document.getElementById('financialTip');
    if (transactions.length === 0) {
        tipElement.textContent = 'Importe seus dados para receber dicas personalizadas de economia.';
        return;
    }
    
    if (balance < 0) {
        tipElement.innerHTML = '<strong style="color: var(--danger);">Atenção:</strong> Você está gastando mais do que ganha! Reduza despesas variáveis imediatamente.';
    } else if (savingsRate < 10) {
        tipElement.innerHTML = '<strong style="color: var(--warning);">Dica:</strong> Tente economizar pelo menos 10% da sua renda. Analise gastos supérfluos.';
    } else if (savingsRate > 30) {
        tipElement.innerHTML = '<strong style="color: var(--success);">Parabéns!</strong> Você está economizando muito bem. Considere investir o excedente.';
    } else {
        tipElement.innerHTML = '<strong style="color: var(--primary);">Bom trabalho!</strong> Suas finanças estão equilibradas. Mantenha o controle.';
    }
}

function updateCharts() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    const categories = {};
    transactions
        .filter(t => t.type !== 'income')
        .forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + t.amount;
        });
    
    const labels = Object.keys(categories);
    const data = Object.values(categories);
    const colors = generateColors(labels.length);
    
    if (expenseChartInstance) expenseChartInstance.destroy();
    
    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#f8fafc', padding: 15 }
                }
            }
        }
    });
}

function updateTopCategories() {
    const categories = {};
    transactions
        .filter(t => t.type !== 'income')
        .forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + t.amount;
        });
    
    const sorted = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const list = document.getElementById('topCategories');
    if (sorted.length === 0) {
        list.innerHTML = '<li class="empty-state"><i class="fas fa-inbox"></i><p>Sem dados para exibir</p></li>';
        return;
    }
    
    const colors = generateColors(sorted.length);
    list.innerHTML = sorted.map((item, index) => `
        <li class="category-item">
            <div class="category-info">
                <div class="category-color" style="background: ${colors[index]}"></div>
                <span class="category-name">${item[0]}</span>
            </div>
            <span class="category-amount">${formatCurrency(item[1])}</span>
        </li>
    `).join('');
}

function updateAnalytics() {
    const monthlyData = {};
    transactions.forEach(t => {
        const month = t.date.substring(0, 7);
        if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
        if (t.type === 'income') monthlyData[month].income += t.amount;
        else monthlyData[month].expense += t.amount;
    });
    
    const months = Object.keys(monthlyData).sort();
    const incomeData = months.map(m => monthlyData[m].income);
    const expenseData = months.map(m => monthlyData[m].expense);
    
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    if (trendChartInstance) trendChartInstance.destroy();
    
    trendChartInstance = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: months.map(m => {
                const [year, month] = m.split('-');
                return `${month}/${year}`;
            }),
            datasets: [{
                label: 'Receitas',
                data: incomeData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Despesas',
                data: expenseData,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            },
            scales: {
                y: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' }
                }
            }
        }
    });
    
    const fixed = transactions.filter(t => t.type === 'fixed').reduce((s, t) => s + t.amount, 0);
    const variable = transactions.filter(t => t.type === 'variable').reduce((s, t) => s + t.amount, 0);
    
    const typeCtx = document.getElementById('typeChart').getContext('2d');
    if (typeChartInstance) typeChartInstance.destroy();
    
    typeChartInstance = new Chart(typeCtx, {
        type: 'pie',
        data: {
            labels: ['Despesas Fixas', 'Despesas Variáveis'],
            datasets: [{
                data: [fixed, variable],
                backgroundColor: ['#f59e0b', '#6366f1']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });
    
    const analysisDiv = document.getElementById('spendingAnalysis');
    if (transactions.length === 0) {
        analysisDiv.innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>Importe dados para ver análises detalhadas</p></div>';
        return;
    }
    
    const totalExpense = fixed + variable;
    const fixedPercent = totalExpense > 0 ? (fixed / totalExpense * 100).toFixed(1) : 0;
    const variablePercent = totalExpense > 0 ? (variable / totalExpense * 100).toFixed(1) : 0;
    
    let recommendation = '';
    if (fixedPercent > 70) {
        recommendation = 'Seus gastos fixos estão muito altos. Tente renegociar contratos ou mudar para opções mais baratas.';
    } else if (variablePercent > 50) {
        recommendation = 'Você tem flexibilidade nos gastos variáveis. Este é o melhor lugar para cortar despesas se precisar economizar.';
    } else {
        recommendation = 'Sua distribuição entre fixos e variáveis está equilibrada.';
    }
    
    analysisDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 20px; background: rgba(245, 158, 11, 0.1); border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.3);">
                <div style="font-size: 2rem; font-weight: 800; color: var(--warning);">${fixedPercent}%</div>
                <div style="color: var(--text-muted); margin-top: 5px;">Gastos Fixos</div>
                <div style="font-size: 0.9rem; margin-top: 5px;">${formatCurrency(fixed)}</div>
            </div>
            <div style="text-align: center; padding: 20px; background: rgba(99, 102, 241, 0.1); border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.3);">
                <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${variablePercent}%</div>
                <div style="color: var(--text-muted); margin-top: 5px;">Gastos Variáveis</div>
                <div style="font-size: 0.9rem; margin-top: 5px;">${formatCurrency(variable)}</div>
            </div>
        </div>
        <div style="padding: 20px; background: rgba(99, 102, 241, 0.1); border-radius: 12px; border-left: 4px solid var(--primary);">
            <i class="fas fa-info-circle" style="color: var(--primary); margin-right: 10px;"></i>
            ${recommendation}
        </div>
    `;
}

// Goals Management
function addGoal(e) {
    e.preventDefault();
    const goal = {
        id: Date.now(),
        name: document.getElementById('goalName').value,
        targetAmount: parseFloat(document.getElementById('goalAmount').value),
        term: document.getElementById('goalTerm').value,
        monthlySaving: parseFloat(document.getElementById('goalMonthly').value),
        currentAmount: 0,
        createdAt: new Date().toISOString()
    };
    
    goals.push(goal);
    saveData();
    renderGoals();
    showNotification('Meta criada com sucesso!');
    e.target.reset();
}

function renderGoals() {
    const container = document.getElementById('goalsContainer');
    if (goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-bullseye"></i>
                <p>Nenhuma meta cadastrada ainda. Crie sua primeira meta!</p>
            </div>
        `;
        return;
    }
    
    const termLabels = {
        short: { label: 'Curto Prazo', class: 'goal-short' },
        medium: { label: 'Médio Prazo', class: 'goal-medium' },
        long: { label: 'Longo Prazo', class: 'goal-long' }
    };
    
    container.innerHTML = goals.map(goal => {
        const progress = (goal.currentAmount / goal.targetAmount * 100).toFixed(1);
        const monthsNeeded = Math.ceil((goal.targetAmount - goal.currentAmount) / goal.monthlySaving);
        const termInfo = termLabels[goal.term];
        
        return `
            <div class="goal-card ${termInfo.class}">
                <div class="goal-header">
                    <div>
                        <div class="goal-title">${goal.name}</div>
                        <span class="goal-type">${termInfo.label}</span>
                    </div>
                    <button class="delete-btn" onclick="deleteGoal(${goal.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="goal-amount">${formatCurrency(goal.targetAmount)}</div>
                <div style="margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.9rem;">
                        <span>Progresso: ${formatCurrency(goal.currentAmount)}</span>
                        <span>${progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, progress)}%"></div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; font-size: 0.9rem; color: var(--text-muted);">
                    <div><i class="fas fa-calendar-alt"></i> ${monthsNeeded} meses restantes</div>
                    <div><i class="fas fa-coins"></i> ${formatCurrency(goal.monthlySaving)}/mês</div>
                </div>
                <button class="btn btn-primary" style="width: 100%; margin-top: 15px;" onclick="addToGoal(${goal.id})">
                    <i class="fas fa-plus"></i> Adicionar Economia
                </button>
            </div>
        `;
    }).join('');
}

function deleteGoal(id) {
    if (confirm('Deseja excluir esta meta?')) {
        goals = goals.filter(g => g.id !== id);
        saveData();
        renderGoals();
        showNotification('Meta excluída!');
    }
}

function addToGoal(id) {
    const amount = parseFloat(prompt('Quanto deseja adicionar à meta? (R$)'));
    if (amount && amount > 0) {
        const goal = goals.find(g => g.id === id);
        if (goal) {
            goal.currentAmount += amount;
            saveData();
            renderGoals();
            showNotification('Economia adicionada!');
        }
    }
}

// Utilities
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatDisplayDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

function generateColors(count) {
    const colors = [
        '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#d946ef'
    ];
    return Array(count).fill(0).map((_, i) => colors[i % colors.length]);
}

function saveData() {
    localStorage.setItem('financial_transactions', JSON.stringify(transactions));
    localStorage.setItem('financial_goals', JSON.stringify(goals));
}

function showNotification(message, type = 'success') {
    const notif = document.getElementById('notification');
    const text = document.getElementById('notificationText');
    text.textContent = message;
    notif.style.background = type === 'error' ? 'var(--danger)' : 'var(--success)';
    notif.style.display = 'flex';
    setTimeout(() => {
        notif.style.display = 'none';
    }, 3000);
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('transactionModal');
    if (event.target === modal) {
        closeModal();
    }
}