import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Percent, 
  PlusCircle, 
  MessageSquare, 
  Send, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Transaction, MonthlyReport } from '../types';

interface DashboardTabProps {
  summary: MonthlyReport | null;
  transactions: Transaction[];
  onOpenNewTx: () => void;
  onNavigateTab: (tab: string) => void;
  onDispatchReport: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  summary,
  transactions,
  onOpenNewTx,
  onNavigateTab,
  onDispatchReport
}) => {
  const totalIncome = summary?.totalIncome || 0;
  const totalExpense = summary?.totalExpense || 0;
  const netBalance = summary?.netBalance || 0;
  const savingsRate = summary?.savingsRate || 0;

  const recentTransactions = transactions.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner with WhatsApp Bot integration status */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Assistente WhatsApp Ativo
              </span>
              <span className="text-xs text-slate-400">Referência: {summary?.monthName || 'Mês Atual'}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Gestão Financeira Automatizada
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Registre despesas em segundos pelo WhatsApp com comandos como <code className="text-emerald-400 bg-slate-800/80 px-1.5 py-0.5 rounded font-mono">.gasto 45 almoço</code> ou linguagem natural. Receba relatórios mensais automáticos!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="dash-btn-simulator"
              onClick={() => onNavigateTab('simulator')}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Testar no WhatsApp</span>
            </button>
            <button
              id="dash-btn-new-tx"
              onClick={onOpenNewTx}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Novo Lançamento</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Líquido */}
        <div className="rounded-2xl p-5 bg-slate-900 border border-slate-800/80 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Saldo Líquido</span>
            <div className={`p-2 rounded-xl ${netBalance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            R$ {netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center text-xs">
            {netBalance >= 0 ? (
              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> Saldo Positivo
              </span>
            ) : (
              <span className="text-rose-400 font-medium flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" /> Saldo Negativo
              </span>
            )}
            <span className="text-slate-500 ml-1.5">neste mês</span>
          </div>
        </div>

        {/* Receitas */}
        <div className="rounded-2xl p-5 bg-slate-900 border border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Receitas</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            + R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Salários, freelas e rendas
          </div>
        </div>

        {/* Despesas */}
        <div className="rounded-2xl p-5 bg-slate-900 border border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Despesas</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 tracking-tight">
            - R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {transactions.filter(t => t.type === 'expense').length} gastos computados
          </div>
        </div>

        {/* Taxa de Poupança */}
        <div className="rounded-2xl p-5 bg-slate-900 border border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Taxa de Poupança</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {savingsRate}%
          </div>
          <div className="mt-2">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(savingsRate, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Budget Breakdown (2 Columns on large) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Orçamentos por Categoria</h2>
              <p className="text-xs text-slate-400">Acompanhamento dos limites e gastos do mês</p>
            </div>
            <button
              onClick={() => onNavigateTab('settings')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Ajustar Metas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {summary?.categories && summary.categories.length > 0 ? (
              summary.categories.map((cat) => {
                const isOver = cat.status === 'exceeded';
                const isWarning = cat.status === 'warning';
                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{cat.category}</span>
                        {isOver && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Limite Excedido
                          </span>
                        )}
                        {isWarning && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                            Atenção ({cat.percentage}%)
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 font-mono">
                        <span className="text-white font-bold">R$ {cat.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span className="text-slate-500"> / R$ {cat.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">Nenhum gasto categorizado ainda.</p>
            )}
          </div>
        </div>

        {/* WhatsApp Bot Quick Command Guide & Connection Card */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Comandos WhatsApp</h3>
                <p className="text-[11px] text-slate-400">Respostas instantâneas no seu chat</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                <span className="font-mono text-emerald-400 font-bold">.menu</span>
                <span className="text-slate-300">Guia de comandos</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                <span className="font-mono text-emerald-400 font-bold">.gasto 45 mercado</span>
                <span className="text-slate-300">Anota despesa</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                <span className="font-mono text-emerald-400 font-bold">.saldo</span>
                <span className="text-slate-300">Resumo financeiro</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                <span className="font-mono text-emerald-400 font-bold">.relatorio</span>
                <span className="text-slate-300">Fechamento do mês</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                <span className="font-mono text-emerald-400 font-bold">.extrato 10</span>
                <span className="text-slate-300">Últimos lançamentos</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => onNavigateTab('simulator')}
                className="w-full py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Abrir Simulador Interativo</span>
              </button>
            </div>
          </div>

          {/* Quick Monthly Dispatch Card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-200">Relatório Mensal WhatsApp</h4>
              <p className="text-[11px] text-slate-400">Disparar fechamento formatado</p>
            </div>
            <button
              onClick={onDispatchReport}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Últimos Lançamentos</h2>
            <p className="text-xs text-slate-400">Registrados via WhatsApp e painel</p>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Ver Todos</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-800/80">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const dateObj = new Date(tx.date);
              const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

              return (
                <div key={tx.id} className="py-3 flex items-center justify-between hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isIncome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-300'}`}>
                      {isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{tx.description}</span>
                        {tx.source === 'whatsapp' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            WhatsApp
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{tx.category}</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                        {tx.paymentMethod && tx.paymentMethod !== 'other' && (
                          <>
                            <span>•</span>
                            <span className="uppercase text-[10px] text-slate-500">{tx.paymentMethod}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-sm font-bold ${isIncome ? 'text-emerald-400' : 'text-slate-100'}`}>
                      {isIncome ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">Nenhum lançamento registrado ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
};
