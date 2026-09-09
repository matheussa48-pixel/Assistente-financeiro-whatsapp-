import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  Send, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  TrendingDown, 
  Copy, 
  Check, 
  Trash2, 
  Zap, 
  ArrowRight, 
  ShieldAlert, 
  BrainCircuit, 
  Briefcase, 
  RefreshCw,
  Calendar,
  AlertOctagon,
  Filter,
  DollarSign
} from 'lucide-react';
import { Debt, AccountantAdvice, FinanceSettings, WhatsAppInstanceId } from '../types';

interface DebtsAccountantTabProps {
  debts: Debt[];
  settings: FinanceSettings;
  onAddDebt: (debt: Omit<Debt, 'id' | 'createdAt'>) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  onDeleteDebt: (id: string) => Promise<void>;
  onRefreshData: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DebtsAccountantTab: React.FC<DebtsAccountantTabProps> = ({
  debts,
  settings,
  onAddDebt,
  onMarkPaid,
  onDeleteDebt,
  onRefreshData,
  showToast
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
  const [advice, setAdvice] = useState<AccountantAdvice | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstanceId>('1');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // New Debt Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newBeneficiary, setNewBeneficiary] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newIsEssential, setNewIsEssential] = useState(false);
  const [newInterest, setNewInterest] = useState('');
  const [newCategory, setNewCategory] = useState('Dívidas & Boletos');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const pendingDebts = debts.filter(d => d.status !== 'paid');
  const overdueDebts = debts.filter(d => d.status === 'overdue' || (d.status === 'pending' && d.dueDate < todayStr));
  const paidDebts = debts.filter(d => d.status === 'paid');

  const totalPendingAmount = pendingDebts.reduce((acc, d) => acc + d.amount, 0);
  const totalOverdueAmount = overdueDebts.reduce((acc, d) => acc + d.amount, 0);
  const totalPaidAmount = paidDebts.reduce((acc, d) => acc + d.amount, 0);

  const fetchAdvice = async () => {
    setIsLoadingAdvice(true);
    try {
      const res = await fetch('/api/accountant/advice');
      if (res.ok) {
        const data = await res.json();
        setAdvice(data);
      }
    } catch (err: any) {
      console.error('Erro ao buscar parecer do contador:', err);
    } finally {
      setIsLoadingAdvice(false);
    }
  };

  useEffect(() => {
    fetchAdvice();
  }, [debts.length]);

  const handleDispatchAdviceToWhatsApp = async () => {
    setIsDispatching(true);
    try {
      const res = await fetch('/api/accountant/dispatch-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: settings.targetWhatsAppNumber,
          instanceId: selectedInstance
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Parecer do Contador enviado com sucesso para o WhatsApp!', 'success');
      } else {
        showToast(data.error || 'Falha ao despachar parecer para o WhatsApp', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar para o WhatsApp', 'error');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCopyBarcode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    showToast('Linha digitável copiada!', 'info');
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim() || !newAmount || !newDueDate) {
      showToast('Preencha descrição, valor e data de vencimento', 'error');
      return;
    }

    const val = parseFloat(newAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      showToast('Valor inválido', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddDebt({
        description: newDesc.trim(),
        amount: val,
        dueDate: newDueDate,
        beneficiary: newBeneficiary.trim() || undefined,
        barcodeOrDigitableLine: newBarcode.trim() || undefined,
        isEssentialService: newIsEssential,
        interestOrLateFee: newInterest ? parseFloat(newInterest.replace(',', '.')) : undefined,
        category: newCategory,
        notes: newNotes.trim() || undefined,
        status: newDueDate < todayStr ? 'overdue' : 'pending',
        source: 'manual'
      });

      showToast('Boleto cadastrado com sucesso!', 'success');
      setIsModalOpen(false);
      // Reset
      setNewDesc('');
      setNewAmount('');
      setNewDueDate('');
      setNewBeneficiary('');
      setNewBarcode('');
      setNewIsEssential(false);
      setNewInterest('');
      setNewNotes('');
      fetchAdvice();
    } catch (err: any) {
      showToast(err.message || 'Erro ao cadastrar boleto', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDebts = debts.filter(d => {
    if (activeFilter === 'pending') return d.status === 'pending' && d.dueDate >= todayStr;
    if (activeFilter === 'overdue') return d.status === 'overdue' || (d.status === 'pending' && d.dueDate < todayStr);
    if (activeFilter === 'paid') return d.status === 'paid';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Contador Profissional IA (CFC/CRC)
              </span>
              <span className="text-xs text-slate-400">
                Comando WhatsApp: <code className="text-emerald-400 font-mono">.boleto</code> e <code className="text-emerald-400 font-mono">.contador</code>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Boletos, Dívidas & Consultoria Contábil
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Lance contas a pagar diretamente pelo WhatsApp ou pelo painel. A inteligência artificial atua como seu contador consultor, determinando a <strong>ordem exata de pagamento</strong> para proteger seus serviços essenciais e liquidar juros destrutivos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Boleto / Dívida</span>
            </button>

            <button
              onClick={fetchAdvice}
              disabled={isLoadingAdvice}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdvice ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Recalcular Análise IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total a Pagar Pendente */}
        <div className="rounded-2xl p-5 bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Total a Pagar (Pendente)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            R$ {totalPendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
            <span>{pendingDebts.length} conta(s) em aberto</span>
          </div>
        </div>

        {/* Total Vencido */}
        <div className="rounded-2xl p-5 bg-slate-900 border border-rose-900/40 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-rose-300">Contas Vencidas</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 tracking-tight">
            R$ {totalOverdueAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-rose-300/80 flex items-center gap-1">
            <span>{overdueDebts.length} boleto(s) em atraso</span>
          </div>
        </div>

        {/* Total Quitado */}
        <div className="rounded-2xl p-5 bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Total Já Quitado</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            R$ {totalPaidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            <span>{paidDebts.length} conta(s) liquidada(s)</span>
          </div>
        </div>

        {/* Score de Saúde Contábil */}
        <div className="rounded-2xl p-5 bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Score de Saúde Contábil</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <BrainCircuit className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-extrabold tracking-tight ${
              (advice?.financialHealthScore || 80) >= 70 ? 'text-emerald-400' :
              (advice?.financialHealthScore || 80) >= 50 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {advice?.financialHealthScore ?? '--'}/100
            </div>
            <span className="text-xs text-slate-400">diagnóstico IA</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 capitalize">
            Método: {advice?.strategyMethod === 'essential_first' ? 'Essenciais 1º' : advice?.strategyMethod || 'Avalanche'}
          </div>
        </div>
      </div>

      {/* AI Accountant Consultation Box */}
      {advice && (
        <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/30 p-6 relative overflow-hidden shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Parecer do Contador & Ordem Estratégica de Pagamento
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    IA ATIVA
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Diagnóstico contábil atualizado com base no seu saldo em caixa e vencimentos
                </p>
              </div>
            </div>

            {/* Dispatch to WhatsApp Button */}
            <div className="flex items-center gap-2">
              <select
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value as WhatsAppInstanceId)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-2"
              >
                <option value="1">Pelo WhatsApp 1</option>
                <option value="2">Pelo WhatsApp 2</option>
              </select>

              <button
                onClick={handleDispatchAdviceToWhatsApp}
                disabled={isDispatching}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer whitespace-nowrap"
                title="Envia o relatório com a ordem de pagamento para o seu WhatsApp"
              >
                <Send className={`w-3.5 h-3.5 ${isDispatching ? 'animate-pulse' : ''}`} />
                <span>{isDispatching ? 'Enviando...' : 'Enviar Parecer no WhatsApp'}</span>
              </button>
            </div>
          </div>

          {/* Diagnostic Banner */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 mb-5 text-xs text-slate-200 leading-relaxed flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-300 font-semibold">Diagnóstico Profissional: </strong>
              {advice.generalVerdict}
            </div>
          </div>

          {/* Recommended Payment Order (The Core Feature) */}
          {advice.recommendations && advice.recommendations.length > 0 ? (
            <div className="space-y-3 mb-5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Ordem Prioritária de Liquidação (O que pagar primeiro)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {advice.recommendations.map((rec) => {
                  const isUrgent = rec.priorityLevel === 'urgent';
                  const isHigh = rec.priorityLevel === 'high';
                  return (
                    <div
                      key={rec.debtId}
                      className={`p-4 rounded-xl border transition-all ${
                        isUrgent
                          ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                          : isHigh
                          ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                          : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                          isUrgent ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          isHigh ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {rec.priorityOrder}º Lugar
                        </span>

                        <span className="text-xs font-bold text-white">
                          R$ {rec.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-100 truncate mb-1">
                        {rec.description}
                      </h4>

                      <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Vencimento: {new Date(rec.dueDate).toLocaleDateString('pt-BR')}</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-1">
                        <p className="text-slate-300 font-medium">
                          <span className="text-emerald-400 font-semibold">Motivo: </span>
                          {rec.strategyReason}
                        </p>
                        <p className="text-slate-400 text-[10px]">
                          <span className="text-amber-400 font-semibold">Plano: </span>
                          {rec.actionPlan}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-end">
                        <button
                          onClick={() => onMarkPaid(rec.debtId)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Marcar como Pago</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-800/40 text-center text-xs text-slate-400">
              Nenhuma dívida pendente para priorização no momento.
            </div>
          )}

          {/* Action Steps & Negotiation Tips in Two Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Checklist */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Passos Recomendados pelo Contador
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {advice.actionSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold shrink-0">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Negotiation Tips */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Dicas de Negociação & Redução de Juros
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {advice.negotiationTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Boletos List Section */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Carteira de Boletos & Dívidas ({filteredDebts.length})
            </h2>
            <p className="text-xs text-slate-400">
              Controle de vencimentos com baixa automática e sincronização financeira
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/80 border border-slate-700/80">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({debts.length})
            </button>
            <button
              onClick={() => setActiveFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeFilter === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pendentes ({pendingDebts.length - overdueDebts.length})
            </button>
            <button
              onClick={() => setActiveFilter('overdue')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeFilter === 'overdue' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vencidos ({overdueDebts.length})
            </button>
            <button
              onClick={() => setActiveFilter('paid')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeFilter === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pagos ({paidDebts.length})
            </button>
          </div>
        </div>

        {/* WhatsApp Command Hint */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[11px]">
              Dica WhatsApp
            </span>
            <span>Você pode lançar boletos enviando no WhatsApp: <code className="text-emerald-400 font-mono">.boleto 150.00 Luz 20/09</code></span>
          </div>
        </div>

        {/* Debt Cards Grid */}
        {filteredDebts.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">Nenhum boleto encontrado nesta categoria.</p>
            <p className="text-xs text-slate-500 mt-1">Clique em "Novo Boleto / Dívida" ou envie pelo WhatsApp com .boleto</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredDebts.map((debt) => {
              const isOverdue = debt.status === 'overdue' || (debt.status === 'pending' && debt.dueDate < todayStr);
              const isPaid = debt.status === 'paid';
              const isEssential = Boolean(debt.isEssentialService);

              // Days diff
              const dueDateTime = new Date(`${debt.dueDate}T12:00:00Z`).getTime();
              const todayTime = new Date(`${todayStr}T12:00:00Z`).getTime();
              const diffDays = Math.round((dueDateTime - todayTime) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={debt.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPaid
                      ? 'bg-slate-950/40 border-slate-800/80 opacity-80'
                      : isOverdue
                      ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                      : 'bg-slate-800/30 border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-white">{debt.description}</h3>
                        {isEssential && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" />
                            Essencial
                          </span>
                        )}
                        {debt.source === 'whatsapp' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            WhatsApp
                          </span>
                        )}
                      </div>

                      {debt.beneficiary && (
                        <p className="text-xs text-slate-400 mt-0.5">Favorecido: {debt.beneficiary}</p>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-white">
                        R$ {debt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] font-semibold mt-0.5">
                        {isPaid ? (
                          <span className="text-emerald-400 flex items-center gap-1 justify-end">
                            <CheckCircle2 className="w-3 h-3" /> Pago
                          </span>
                        ) : isOverdue ? (
                          <span className="text-rose-400 flex items-center gap-1 justify-end">
                            <AlertOctagon className="w-3 h-3" /> Vencido há {Math.abs(diffDays)}d
                          </span>
                        ) : diffDays === 0 ? (
                          <span className="text-amber-400 font-bold">Vence Hoje!</span>
                        ) : (
                          <span className="text-slate-400">Vence em {diffDays} dias</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Due date and Barcode */}
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Vencimento: {new Date(debt.dueDate).toLocaleDateString('pt-BR')}
                    </span>

                    {debt.paidAt && (
                      <span className="text-emerald-400 text-[11px]">
                        Pago em {new Date(debt.paidAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>

                  {/* Barcode / Digitable Line */}
                  {debt.barcodeOrDigitableLine && (
                    <div className="mt-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <code className="text-emerald-400 font-mono text-[11px] truncate select-all">
                        {debt.barcodeOrDigitableLine}
                      </code>
                      <button
                        onClick={() => handleCopyBarcode(debt.id, debt.barcodeOrDigitableLine!)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Copiar linha digitável"
                      >
                        {copiedCodeId === debt.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <div>
                      {!isPaid && (
                        <button
                          onClick={() => onMarkPaid(debt.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Pagar & Baixar</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => onDeleteDebt(debt.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Excluir dívida"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Debt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Cadastrar Novo Boleto / Dívida</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição da Conta / Boleto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Conta de Luz Enel, Aluguel Apartamento, Fatura Cartão"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 150,00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Favorecido / Beneficiário
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Enel Distribuição, Imobiliária X"
                    value={newBeneficiary}
                    onChange={(e) => setNewBeneficiary(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Juros / Multa Estimada (%)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2.0% ao mês"
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Linha Digitável / Código de Barras (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Cole os 47 ou 48 dígitos do boleto"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Essential Service Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <input
                  type="checkbox"
                  id="essential-check"
                  checked={newIsEssential}
                  onChange={(e) => setNewIsEssential(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="essential-check" className="text-xs text-slate-200 cursor-pointer">
                  <span className="font-semibold text-white">Serviço Essencial</span> (Luz, Água, Gás, Aluguel ou Internet)
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    O Contador IA colocará este boleto com prioridade máxima para evitar corte de fornecimento.
                  </p>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : 'Cadastrar Boleto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
