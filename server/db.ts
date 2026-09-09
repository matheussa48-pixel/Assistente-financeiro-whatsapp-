import fs from 'fs';
import path from 'path';
import { 
  Transaction, 
  Category, 
  FinanceSettings, 
  WhatsAppMessageLog, 
  MonthlyReport, 
  CategorySpending,
  Debt 
} from '../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'finance_data.json');

interface DatabaseSchema {
  transactions: Transaction[];
  debts: Debt[];
  categories: Category[];
  settings: FinanceSettings;
  logs: WhatsAppMessageLog[];
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Alimentação', icon: 'UtensilsCrossed', color: '#f97316', monthlyBudget: 1200 },
  { id: 'cat-2', name: 'Moradia & Contas', icon: 'Home', color: '#3b82f6', monthlyBudget: 2200 },
  { id: 'cat-3', name: 'Transporte', icon: 'Car', color: '#8b5cf6', monthlyBudget: 650 },
  { id: 'cat-4', name: 'Lazer & Restaurantes', icon: 'Smile', color: '#ec4899', monthlyBudget: 500 },
  { id: 'cat-5', name: 'Saúde & Bem-Estar', icon: 'HeartPulse', color: '#10b981', monthlyBudget: 400 },
  { id: 'cat-6', name: 'Educação & Cursos', icon: 'GraduationCap', color: '#06b6d4', monthlyBudget: 350 },
  { id: 'cat-7', name: 'Assinaturas & Tech', icon: 'Tv', color: '#eab308', monthlyBudget: 200 },
  { id: 'cat-8', name: 'Salário & Renda', icon: 'Briefcase', color: '#22c55e', monthlyBudget: 0 },
  { id: 'cat-9', name: 'Dívidas & Boletos', icon: 'FileText', color: '#ef4444', monthlyBudget: 1500 },
  { id: 'cat-10', name: 'Outros', icon: 'HelpCircle', color: '#64748b', monthlyBudget: 300 }
];

const DEFAULT_AUTO_RESPONDER_PROMPT = `Você é o assistente virtual financeiro e de atendimento no WhatsApp.
Você também atua como um Consultor e Contador Financeiro Profissional (CFC/CRC).

DIRETRIZES DE ATENDIMENTO:
1. Saudação: Cumprimente com educação e objetividade chamando pelo nome quando disponível.
2. Boletos e Dívidas (.boleto): Ajude a cadastrar boletos a pagar, alertando sobre vencimentos e juros de atraso.
3. Consultoria do Contador (.contador ou .analise): Oriente qual dívida pagar primeiro com base em prioridade estratégica (serviços essenciais > juros mais altos como cartão de crédito > multas imediatas).
4. Comprovantes de Pagamento: Valide comprovantes (PIX, TED, Boleto) extraindo valor, pagador, recebedor e banco.
5. Controle Financeiro: Auxilie no registro de gastos (.gasto) e receitas (.receita).
6. Formatação: Use negrito nas palavras essenciais e emojis agradáveis para leitura no celular.`;

const DEFAULT_SETTINGS: FinanceSettings = {
  botName: 'FinAssist WhatsApp',
  commandPrefix: '.',
  autoMonthlyReport: true,
  reportDayOfMonth: 28,
  reportTime: '09:00',
  targetWhatsAppNumber: '5511999998888',
  enableAiParsing: true,
  currencySymbol: 'R$',
  autoResponderEnabled: true,
  autoResponderInstance1: true,
  autoResponderInstance2: true,
  autoResponderName: 'Contador & Atendente Virtual IA',
  autoResponderPrompt: DEFAULT_AUTO_RESPONDER_PROMPT,
  readPaymentReceipts: true,
  autoRegisterReceiptTransactions: true
};

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
    // Clear all previously saved transactions/logs/debts as per user instruction ("agora apague todos os dados salvos")
    this.clearAllData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          transactions: parsed.transactions || [],
          debts: parsed.debts || [],
          categories: parsed.categories || DEFAULT_CATEGORIES,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          logs: parsed.logs || []
        };
      }
    } catch (err) {
      console.warn('Erro ao carregar banco de dados, iniciando vazio:', err);
    }

    const initialData: DatabaseSchema = {
      transactions: [],
      debts: [],
      categories: DEFAULT_CATEGORIES,
      settings: DEFAULT_SETTINGS,
      logs: []
    };
    this.saveData(initialData);
    return initialData;
  }

  private saveData(data: DatabaseSchema = this.data) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erro ao salvar dados:', err);
    }
  }

  /**
   * Resets all saved user data (transactions, debts, logs) to a fresh clean slate
   */
  clearAllData(): void {
    this.data.transactions = [];
    this.data.debts = [];
    this.data.logs = [];
    this.saveData();
    console.log('🧹 [Database] Todos os dados salvos foram apagados com sucesso!');
  }

  // ==========================================
  // TRANSACTIONS
  // ==========================================
  getTransactions(): Transaction[] {
    return [...this.data.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  addTransaction(txData: Omit<Transaction, 'id'>): Transaction {
    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...txData
    };
    this.data.transactions.unshift(newTx);
    this.saveData();
    return newTx;
  }

  deleteTransaction(id: string): boolean {
    const initialLen = this.data.transactions.length;
    this.data.transactions = this.data.transactions.filter((t) => t.id !== id);
    if (this.data.transactions.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  // ==========================================
  // BOLETOS E DÍVIDAS A PAGAR (DEBTS)
  // ==========================================
  getDebts(): Debt[] {
    const todayStr = new Date().toISOString().split('T')[0];

    // Auto-update status if dueDate has passed and it is still pending
    let changed = false;
    this.data.debts.forEach((debt) => {
      if (debt.status === 'pending' && debt.dueDate < todayStr) {
        debt.status = 'overdue';
        changed = true;
      }
    });

    if (changed) {
      this.saveData();
    }

    return [...this.data.debts].sort((a, b) => {
      // Pending and overdue first, then by dueDate ascending
      if (a.status !== 'paid' && b.status === 'paid') return -1;
      if (a.status === 'paid' && b.status !== 'paid') return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }

  getDebt(id: string): Debt | undefined {
    return this.data.debts.find((d) => d.id === id);
  }

  addDebt(debtData: Omit<Debt, 'id' | 'createdAt'>): Debt {
    const todayStr = new Date().toISOString().split('T')[0];
    const initialStatus = debtData.dueDate < todayStr ? 'overdue' : (debtData.status || 'pending');

    const newDebt: Debt = {
      id: `debt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...debtData,
      status: initialStatus
    };

    this.data.debts.unshift(newDebt);
    this.saveData();
    return newDebt;
  }

  updateDebt(id: string, updates: Partial<Debt>): Debt | null {
    const debt = this.data.debts.find((d) => d.id === id);
    if (!debt) return null;

    Object.assign(debt, updates);
    this.saveData();
    return debt;
  }

  deleteDebt(id: string): boolean {
    const initialLen = this.data.debts.length;
    this.data.debts = this.data.debts.filter((d) => d.id !== id);
    if (this.data.debts.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  markDebtPaid(id: string, createTransaction: boolean = true): { debt: Debt; transaction?: Transaction } | null {
    const debt = this.data.debts.find((d) => d.id === id);
    if (!debt) return null;

    debt.status = 'paid';
    debt.paidAt = new Date().toISOString();

    let tx: Transaction | undefined;
    if (createTransaction) {
      tx = this.addTransaction({
        type: 'expense',
        amount: debt.amount,
        description: `Pagamento de Boleto: ${debt.description}`,
        category: debt.category || 'Dívidas & Boletos',
        paymentMethod: 'pix',
        date: new Date().toISOString(),
        source: 'manual',
        notes: `Boleto ID: ${debt.id}. Linha digitável: ${debt.barcodeOrDigitableLine || 'N/A'}`
      });
      debt.paidTransactionId = tx.id;
    }

    this.saveData();
    return { debt, transaction: tx };
  }

  // ==========================================
  // CATEGORIES
  // ==========================================
  getCategories(): Category[] {
    return [...this.data.categories];
  }

  updateCategory(id: string, updates: Partial<Category>): Category | null {
    const cat = this.data.categories.find((c) => c.id === id);
    if (!cat) return null;
    Object.assign(cat, updates);
    this.saveData();
    return cat;
  }

  // ==========================================
  // SETTINGS
  // ==========================================
  getSettings(): FinanceSettings {
    return { ...this.data.settings };
  }

  updateSettings(newSettings: Partial<FinanceSettings>): FinanceSettings {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.saveData();
    return { ...this.data.settings };
  }

  // ==========================================
  // WHATSAPP LOGS
  // ==========================================
  getLogs(): WhatsAppMessageLog[] {
    return [...this.data.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  addLog(logData: Omit<WhatsAppMessageLog, 'id'>): WhatsAppMessageLog {
    const newLog: WhatsAppMessageLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...logData
    };
    this.data.logs.unshift(newLog);
    // Keep max 200 logs
    if (this.data.logs.length > 200) {
      this.data.logs = this.data.logs.slice(0, 200);
    }
    this.saveData();
    return newLog;
  }

  clearLogs(): void {
    this.data.logs = [];
    this.saveData();
  }

  // ==========================================
  // MONTHLY FINANCIAL REPORT
  // ==========================================
  generateMonthlyReport(targetMonthYear?: string): MonthlyReport {
    const now = new Date();
    const monthYear = targetMonthYear || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;

    const monthDate = new Date(year, monthIndex, 1);
    const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const formattedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const monthTransactions = this.data.transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const categorySpentMap: Record<string, number> = {};

    monthTransactions.forEach((tx) => {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
        categorySpentMap[tx.category] = (categorySpentMap[tx.category] || 0) + tx.amount;
      }
    });

    const netBalance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    const categoriesSpending: CategorySpending[] = this.data.categories
      .filter((c) => c.name !== 'Salário & Renda')
      .map((cat) => {
        const spent = categorySpentMap[cat.name] || 0;
        const budget = cat.monthlyBudget || 0;
        const percentage = budget > 0 ? (spent / budget) * 100 : 0;

        let status: 'ok' | 'warning' | 'exceeded' = 'ok';
        if (percentage >= 100) {
          status = 'exceeded';
        } else if (percentage >= 80) {
          status = 'warning';
        }

        return {
          category: cat.name,
          color: cat.color,
          icon: cat.icon,
          spent,
          budget,
          percentage: Math.round(percentage),
          status
        };
      })
      .sort((a, b) => b.spent - a.spent);

    const topExpenses = monthTransactions
      .filter((tx) => tx.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Build WhatsApp friendly text
    const formatBrl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

    let whatsappText = `📊 *FECHAMENTO FINANCEIRO - ${formattedMonthName.toUpperCase()}*\n`;
    whatsappText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    whatsappText += `💵 *Receitas Totais:* ${formatBrl(totalIncome)}\n`;
    whatsappText += `💳 *Despesas Totais:* ${formatBrl(totalExpense)}\n`;
    whatsappText += `📈 *Saldo Líquido:* ${netBalance >= 0 ? '+' : ''}${formatBrl(netBalance)}\n`;
    whatsappText += `🎯 *Taxa de Poupança:* ${savingsRate.toFixed(1)}%\n\n`;

    whatsappText += `*Gastos por Categoria:*\n`;
    categoriesSpending
      .filter((c) => c.spent > 0)
      .forEach((c) => {
        const statusEmoji = c.status === 'exceeded' ? '🔴' : c.status === 'warning' ? '🟡' : '🟢';
        whatsappText += `${statusEmoji} ${c.category}: ${formatBrl(c.spent)}`;
        if (c.budget > 0) {
          whatsappText += ` (${c.percentage}% do teto)`;
        }
        whatsappText += `\n`;
      });

    if (topExpenses.length > 0) {
      whatsappText += `\n*Maiores Despesas do Mês:*\n`;
      topExpenses.forEach((tx, idx) => {
        const d = new Date(tx.date).toLocaleDateString('pt-BR');
        whatsappText += `${idx + 1}. ${tx.description} - ${formatBrl(tx.amount)} (${d})\n`;
      });
    }

    whatsappText += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    whatsappText += `_Relatório gerado automaticamente por ${this.data.settings.botName}_`;

    return {
      monthYear,
      monthName: formattedMonthName,
      totalIncome,
      totalExpense,
      netBalance,
      savingsRate: Math.max(0, savingsRate),
      categories: categoriesSpending,
      topExpenses,
      totalTransactionsCount: monthTransactions.length,
      whatsappFormattedText: whatsappText
    };
  }
}

export const db = new Database();
