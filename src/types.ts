export type TransactionType = 'expense' | 'income';

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'transfer' | 'other';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  paymentMethod: PaymentMethod;
  date: string; // ISO string
  source: 'whatsapp' | 'manual' | 'ai_simulation';
  whatsappSender?: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  monthlyBudget: number;
}

export interface CategorySpending {
  category: string;
  color: string;
  icon: string;
  spent: number;
  budget: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface MonthlyReport {
  monthYear: string; // "YYYY-MM"
  monthName: string; // "Setembro 2026"
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  savingsRate: number; // percentage e.g. 25.4
  categories: CategorySpending[];
  topExpenses: Transaction[];
  totalTransactionsCount: number;
  whatsappFormattedText: string;
}

export type WhatsAppInstanceId = '1' | '2';

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

export interface WhatsAppSessionInfo {
  instanceId: WhatsAppInstanceId;
  instanceName: string;
  status: WhatsAppConnectionStatus;
  qrCodeDataUrl: string | null;
  pairingCode: string | null;
  rawPairingCode?: string | null;
  alternativePhone?: string | null;
  pairingCodeNote?: string | null;
  userPhone: string | null;
  userName: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  activeChatsCount: number;
}

export interface PaymentReceiptData {
  isReceipt: boolean;
  receiptType: 'pix' | 'transfer' | 'boleto' | 'credit_card' | 'debit_card' | 'deposit' | 'other';
  amount: number;
  date?: string;
  payerName?: string;
  payerDocument?: string;
  receiverName?: string;
  receiverDocument?: string;
  bankOrInstitution?: string;
  transactionId?: string;
  status?: string;
  summary?: string;
  extractedNotes?: string;
  confidence?: number;
}

export type DebtStatus = 'pending' | 'paid' | 'overdue';
export type DebtPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Debt {
  id: string;
  description: string;
  amount: number;
  dueDate: string; // "YYYY-MM-DD"
  status: DebtStatus;
  category?: string;
  barcodeOrDigitableLine?: string;
  beneficiary?: string;
  interestOrLateFee?: number; // Estimated % or nominal late fee
  isEssentialService?: boolean; // Luz, Água, Aluguel, etc.
  paidAt?: string;
  paidTransactionId?: string;
  notes?: string;
  source?: 'whatsapp' | 'manual' | 'receipt_scan';
  createdAt: string;
}

export interface DebtRecommendation {
  debtId: string;
  description: string;
  amount: number;
  dueDate: string;
  priorityOrder: number; // 1, 2, 3...
  priorityLevel: 'urgent' | 'high' | 'medium' | 'low';
  strategyReason: string;
  actionPlan: string;
}

export interface AccountantAdvice {
  id: string;
  analyzedAt: string;
  currentBalance: number;
  totalDebtsPending: number;
  totalDebtsOverdue: number;
  financialHealthScore: number; // 0 - 100
  generalVerdict: string;
  strategyMethod: 'avalanche' | 'snowball' | 'hybrid' | 'essential_first';
  recommendations: DebtRecommendation[];
  actionSteps: string[];
  negotiationTips: string[];
  whatsappFormattedAdvice: string;
}

export interface WhatsAppMessageLog {
  id: string;
  timestamp: string;
  direction: 'incoming' | 'outgoing';
  from: string;
  to: string;
  text: string;
  senderName?: string;
  commandDetected?: string;
  transactionCreated?: Partial<Transaction>;
  debtCreated?: Partial<Debt>;
  instanceId?: WhatsAppInstanceId;
  hasImage?: boolean;
  receiptData?: PaymentReceiptData;
}

export interface FinanceSettings {
  botName: string;
  commandPrefix: string;
  autoMonthlyReport: boolean;
  reportDayOfMonth: number;
  reportTime: string; // "09:00"
  targetWhatsAppNumber: string;
  enableAiParsing: boolean;
  currencySymbol: string;
  // Auto-responder & Atendimento IA
  autoResponderEnabled: boolean;
  autoResponderInstance1: boolean;
  autoResponderInstance2: boolean;
  autoResponderName: string;
  autoResponderPrompt: string;
  readPaymentReceipts: boolean;
  autoRegisterReceiptTransactions: boolean;
}
