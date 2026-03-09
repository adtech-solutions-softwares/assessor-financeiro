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
    //updateDashboard();
    //renderTransactions();
    //renderGoals();
    //populateFilters();
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

// ... (restante do código mantido igual: saveTransaction, deleteTransaction, maskCurrency, parseCurrency, formatCurrency, populateFilters, applyFilters, renderTransactionsTable, etc.)

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