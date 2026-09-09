import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardTab } from './components/DashboardTab';
import { DebtsAccountantTab } from './components/DebtsAccountantTab';
import { WhatsAppTab } from './components/WhatsAppTab';
import { AutoResponderTab } from './components/AutoResponderTab';
import { WhatsAppSimulatorTab } from './components/WhatsAppSimulatorTab';
import { TransactionsTab } from './components/TransactionsTab';
import { ReportsTab } from './components/ReportsTab';
import { SettingsTab } from './components/SettingsTab';
import { 
  WhatsAppSessionInfo, 
  WhatsAppMessageLog, 
  Transaction, 
  Category, 
  MonthlyReport, 
  FinanceSettings,
  WhatsAppInstanceId,
  Debt
} from './types';
import { BotProcessResult } from '../server/botEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [waInstances, setWaInstances] = useState<WhatsAppSessionInfo[]>([
    {
      instanceId: '1',
      instanceName: 'WhatsApp 1 (Principal)',
      status: 'disconnected',
      qrCodeDataUrl: null,
      pairingCode: null,
      userPhone: null,
      userName: null,
      lastConnectedAt: null,
      lastError: null,
      activeChatsCount: 0
    },
    {
      instanceId: '2',
      instanceName: 'WhatsApp 2 (Atendimento)',
      status: 'disconnected',
      qrCodeDataUrl: null,
      pairingCode: null,
      userPhone: null,
      userName: null,
      lastConnectedAt: null,
      lastError: null,
      activeChatsCount: 0
    }
  ]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [logs, setLogs] = useState<WhatsAppMessageLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<MonthlyReport | null>(null);
  const [settings, setSettings] = useState<FinanceSettings>({
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
    autoResponderName: 'Atendente Virtual IA',
    readPaymentReceipts: true,
    autoRegisterReceiptTransactions: true
  });

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // ----------------------------------------------------
  // DATA FETCHING
  // ----------------------------------------------------
  const fetchInstances = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/instances');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setWaInstances(data);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchDebts = useCallback(async () => {
    try {
      const res = await fetch('/api/debts');
      if (res.ok) {
        const data = await res.json();
        setDebts(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSummary = useCallback(async (monthYear: string = selectedMonth) => {
    try {
      const res = await fetch(`/api/finance/report?month=${monthYear}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      // ignore
    }
  }, [selectedMonth]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchInstances();
    fetchLogs();
    fetchTransactions();
    fetchDebts();
    fetchCategories();
    fetchSummary(selectedMonth);
    fetchSettings();
  }, [fetchInstances, fetchLogs, fetchTransactions, fetchDebts, fetchCategories, fetchSummary, selectedMonth, fetchSettings]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Periodic polling for WhatsApp connection status and logs
  useEffect(() => {
    const timer = setInterval(() => {
      fetchInstances();
      fetchLogs();
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchInstances, fetchLogs]);

  // When selected month changes, refresh summary
  useEffect(() => {
    fetchSummary(selectedMonth);
  }, [selectedMonth, fetchSummary]);

  // ----------------------------------------------------
  // ACTION HANDLERS (DUAL INSTANCE)
  // ----------------------------------------------------
  const handleConnectWhatsApp = async (instanceId?: WhatsAppInstanceId) => {
    setIsConnecting(true);
    showToast(`Iniciando socket Baileys ${instanceId ? `Instância ${instanceId}` : 'de ambas as contas'}...`, 'info');
    try {
      const res = await fetch('/api/whatsapp/connect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId })
      });
      if (res.ok) {
        await fetchInstances();
        showToast('Socket Baileys iniciado. Escaneie o QR Code ou gere o código de pareamento!', 'info');
      } else {
        const err = await res.json();
        showToast(err.error || 'Falha ao conectar Baileys', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao conectar WhatsApp', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWhatsApp = async (instanceId?: WhatsAppInstanceId) => {
    try {
      const res = await fetch('/api/whatsapp/disconnect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId })
      });
      if (res.ok) {
        await fetchInstances();
        showToast(`Sessão ${instanceId ? `WhatsApp ${instanceId}` : 'todas'} desconectada.`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao desconectar', 'error');
    }
  };

  const handleRequestPairingCode = async (phone: string, instanceId: WhatsAppInstanceId = '1'): Promise<string | null> => {
    try {
      const res = await fetch('/api/whatsapp/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, instanceId })
      });
      const data = await res.json();
      if (res.ok && data.pairingCode) {
        await fetchInstances();
        showToast(`Código de pareamento gerado com sucesso para WhatsApp ${instanceId}!`, 'success');
        return data.pairingCode;
      } else {
        throw new Error(data.error || 'Falha ao obter código de pareamento');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleSimulateMessage = async (
    text: string, 
    instanceId: WhatsAppInstanceId = '1',
    imageBase64?: string,
    mimeType?: string
  ): Promise<BotProcessResult> => {
    const res = await fetch('/api/whatsapp/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text, 
        sender: settings.targetWhatsAppNumber,
        instanceId,
        imageBase64,
        mimeType
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro na simulação');
    }
    // Refresh local transactions, debts & summary
    fetchTransactions();
    fetchDebts();
    fetchSummary(selectedMonth);
    fetchLogs();
    return data;
  };

  const handleDispatchReport = async (phone?: string) => {
    try {
      const res = await fetch('/api/finance/dispatch-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Relatório enviado com sucesso!', 'success');
        fetchLogs();
      } else {
        throw new Error(data.error || 'Falha no envio');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao despachar relatório', 'error');
      throw err;
    }
  };

  const handleAddTransaction = async (txData: Omit<Transaction, 'id'>) => {
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
      if (res.ok) {
        showToast('Lançamento registrado com sucesso!', 'success');
        fetchTransactions();
        fetchSummary(selectedMonth);
      } else {
        const err = await res.json();
        showToast(err.error || 'Erro ao registrar lançamento', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar', 'error');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Lançamento removido com sucesso!', 'info');
        fetchTransactions();
        fetchSummary(selectedMonth);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao deletar', 'error');
    }
  };

  // ----------------------------------------------------
  // DEBTS & BOLETOS HANDLERS
  // ----------------------------------------------------
  const handleAddDebt = async (debtData: Omit<Debt, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(debtData)
      });
      if (res.ok) {
        showToast('Boleto cadastrado com sucesso!', 'success');
        fetchDebts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Erro ao cadastrar boleto', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao cadastrar boleto', 'error');
    }
  };

  const handleMarkDebtPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/debts/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createTransaction: true })
      });
      if (res.ok) {
        showToast('Boleto marcado como pago e despesa registrada!', 'success');
        fetchDebts();
        fetchTransactions();
        fetchSummary(selectedMonth);
      } else {
        const err = await res.json();
        showToast(err.error || 'Erro ao baixar boleto', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao baixar boleto', 'error');
    }
  };

  const handleDeleteDebt = async (id: string) => {
    try {
      const res = await fetch(`/api/debts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Boleto/Dívida excluída com sucesso.', 'info');
        fetchDebts();
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir dívida', 'error');
    }
  };

  // Clear all saved data
  const handleClearAllData = async () => {
    try {
      const res = await fetch('/api/system/clear-data', { method: 'POST' });
      if (res.ok) {
        showToast('Todos os dados salvos foram apagados com sucesso!', 'success');
        refreshAll();
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao apagar dados', 'error');
    }
  };

  const handleUpdateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      const res = await fetch(`/api/finance/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        showToast('Limite da categoria atualizado!', 'success');
        fetchCategories();
        fetchSummary(selectedMonth);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar categoria', 'error');
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<FinanceSettings>) => {
    try {
      const res = await fetch('/api/finance/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        showToast('Configurações salvas com sucesso!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar configurações', 'error');
    }
  };

  const handleSendManualMessage = async (to: string, text: string, instanceId: WhatsAppInstanceId = '1') => {
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, text, instanceId })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Mensagem enviada com sucesso pelo WhatsApp ${instanceId}!`, 'success');
        fetchLogs();
      } else {
        throw new Error(data.error || 'Falha ao enviar');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar mensagem', 'error');
      throw err;
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/whatsapp/logs', { method: 'DELETE' });
      setLogs([]);
      showToast('Histórico de logs limpo.', 'info');
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-fade-in transition-all">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        waInstances={waInstances}
        onRefreshStatus={fetchInstances}
        isConnecting={isConnecting}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardTab
            summary={summary}
            transactions={transactions}
            onOpenNewTx={() => setIsNewTxModalOpen(true)}
            onNavigateTab={setActiveTab}
            onDispatchReport={() => handleDispatchReport()}
          />
        )}

        {activeTab === 'debts' && (
          <DebtsAccountantTab
            debts={debts}
            settings={settings}
            onAddDebt={handleAddDebt}
            onMarkPaid={handleMarkDebtPaid}
            onDeleteDebt={handleDeleteDebt}
            onRefreshData={refreshAll}
            showToast={showToast}
          />
        )}

        {activeTab === 'whatsapp' && (
          <WhatsAppTab
            waInstances={waInstances}
            logs={logs}
            isConnecting={isConnecting}
            onConnect={handleConnectWhatsApp}
            onDisconnect={handleDisconnectWhatsApp}
            onRequestPairingCode={handleRequestPairingCode}
            onRefreshLogs={fetchLogs}
            onClearLogs={handleClearLogs}
            onSendManualMessage={handleSendManualMessage}
          />
        )}

        {activeTab === 'autoresponder' && (
          <AutoResponderTab
            settings={settings}
            waInstances={waInstances}
            onUpdateSettings={handleUpdateSettings}
            onRefreshData={() => {
              fetchTransactions();
              fetchDebts();
              fetchSummary(selectedMonth);
              fetchLogs();
            }}
          />
        )}

        {activeTab === 'simulator' && (
          <WhatsAppSimulatorTab
            onSimulateMessage={handleSimulateMessage}
            onRefreshData={() => {
              fetchTransactions();
              fetchDebts();
              fetchSummary(selectedMonth);
            }}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsTab
            transactions={transactions}
            categories={categories}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            isModalOpen={isNewTxModalOpen}
            setIsModalOpen={setIsNewTxModalOpen}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab
            report={summary}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onDispatchReport={handleDispatchReport}
            onSelectMonth={setSelectedMonth}
            selectedMonth={selectedMonth}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            categories={categories}
            onUpdateSettings={handleUpdateSettings}
            onUpdateCategory={handleUpdateCategory}
            onClearAllData={handleClearAllData}
          />
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-slate-800/60 py-4 text-center text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>FinAssist • Gestão Financeira, Boletos & Contador Consultor IA em 2 WhatsApps</span>
          <span className="text-slate-600 font-mono text-[11px]">Baileys Dual-Instance • Leitura de Comprovantes PIX/Boletos • Gemini AI</span>
        </div>
      </footer>
    </div>
  );
}
