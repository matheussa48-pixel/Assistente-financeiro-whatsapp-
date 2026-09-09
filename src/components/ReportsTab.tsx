import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Send, 
  Copy, 
  Check, 
  Calendar, 
  Clock, 
  Smartphone, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { MonthlyReport, FinanceSettings } from '../types';

interface ReportsTabProps {
  report: MonthlyReport | null;
  settings: FinanceSettings;
  onUpdateSettings: (settings: Partial<FinanceSettings>) => Promise<void>;
  onDispatchReport: (phone?: string) => Promise<void>;
  onSelectMonth: (monthYear: string) => void;
  selectedMonth: string;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  report,
  settings,
  onUpdateSettings,
  onDispatchReport,
  onSelectMonth,
  selectedMonth
}) => {
  const [copied, setCopied] = useState(false);
  const [dispatchPhone, setDispatchPhone] = useState(settings.targetWhatsAppNumber || '');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);

  // Scheduling states
  const [autoReport, setAutoReport] = useState(settings.autoMonthlyReport);
  const [reportDay, setReportDay] = useState(settings.reportDayOfMonth);
  const [targetNumber, setTargetNumber] = useState(settings.targetWhatsAppNumber);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleCopy = () => {
    if (!report?.whatsappFormattedText) return;
    navigator.clipboard.writeText(report.whatsappFormattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchPhone) return;
    setIsDispatching(true);
    setDispatchResult(null);
    try {
      await onDispatchReport(dispatchPhone);
      setDispatchResult(`Relatório disparado com sucesso para ${dispatchPhone}!`);
      setTimeout(() => setDispatchResult(null), 4000);
    } catch (err: any) {
      setDispatchResult(`Erro ao enviar: ${err.message || 'Falha no envio'}`);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await onUpdateSettings({
        autoMonthlyReport: autoReport,
        reportDayOfMonth: Number(reportDay),
        targetWhatsAppNumber: targetNumber
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <span>Relatórios Mensais & Fechamento Automático</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gere, visualize e configure o envio automático de relatórios financeiros detalhados diretamente no WhatsApp do usuário.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Overview Cards for Selected Month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400">Total Receitas</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            R$ {report?.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400">Total Despesas</span>
          <div className="text-xl font-bold text-rose-400 mt-1">
            R$ {report?.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400">Saldo Líquido</span>
          <div className="text-xl font-bold text-white mt-1">
            R$ {report?.netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400">Taxa de Poupança</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {report?.savingsRate || 0}%
          </div>
        </div>
      </div>

      {/* Main Grid: WhatsApp Formatted Preview + Automation Dispatcher */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Preview Card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Mensagem Formatada para WhatsApp</h3>
              </div>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

            {/* Formatted Phone Preview Box */}
            <div className="p-4 rounded-xl bg-[#0c1317] border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto shadow-inner">
              {report?.whatsappFormattedText || 'Carregando relatório...'}
            </div>
          </div>

          {/* Quick Manual Dispatch Form */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-200 mb-2">Disparar este Relatório Agora</h4>
            <form onSubmit={handleDispatch} className="flex gap-2">
              <input
                type="text"
                value={dispatchPhone}
                onChange={(e) => setDispatchPhone(e.target.value)}
                placeholder="Número WhatsApp (ex: 5511999998888)"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isDispatching || !dispatchPhone}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isDispatching ? 'Enviando...' : 'Enviar WhatsApp'}</span>
              </button>
            </form>
            {dispatchResult && (
              <p className={`text-xs mt-2 ${dispatchResult.includes('sucesso') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {dispatchResult}
              </p>
            )}
          </div>
        </div>

        {/* Automated Monthly Dispatch Configuration */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Configuração de Disparo Automático</h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              O assistente pode enviar o fechamento financeiro do mês automaticamente para seu WhatsApp em um dia e horário programado.
            </p>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              {/* Toggle Enable */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div>
                  <span className="font-semibold text-xs text-white block">Envio Mensal Automático</span>
                  <span className="text-[11px] text-slate-400">Ativa o cron de disparo no WhatsApp</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoReport}
                  onChange={(e) => setAutoReport(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Day of Month */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Dia do Mês para Fechamento
                </label>
                <select
                  value={reportDay}
                  onChange={(e) => setReportDay(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value={1}>Todo dia 01 (Início do mês)</option>
                  <option value={5}>Todo dia 05 (Dia de pagamento comum)</option>
                  <option value={15}>Todo dia 15 (Metade do mês)</option>
                  <option value={25}>Todo dia 25</option>
                  <option value={28}>Todo dia 28 (Fim do mês)</option>
                  <option value={30}>Todo dia 30</option>
                </select>
              </div>

              {/* Recipient Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Número de Destino Padrão (com DDI e DDD)
                </label>
                <input
                  type="text"
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value)}
                  placeholder="Ex: 5511999998888"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-emerald-600/20 transition-all"
              >
                {isSavingSettings ? 'Salvando...' : 'Salvar Regra de Envio Automático'}
              </button>

              {savedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Configurações salvas com sucesso!</span>
                </div>
              )}
            </form>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">💡 Como funciona o comando no WhatsApp:</p>
            <p>Se você preferir receber na hora, basta mandar <code className="text-emerald-400 font-mono">.relatorio</code> na conversa do WhatsApp e o bot enviará o fechamento imediatamente!</p>
          </div>
        </div>
      </div>
    </div>
  );
};
