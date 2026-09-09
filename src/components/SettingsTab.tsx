import React, { useState } from 'react';
import { 
  Settings, 
  Bot, 
  Tags, 
  Check, 
  DollarSign, 
  Sparkles, 
  ShieldCheck,
  CheckCircle2,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { FinanceSettings, Category } from '../types';

interface SettingsTabProps {
  settings: FinanceSettings;
  categories: Category[];
  onUpdateSettings: (newSettings: Partial<FinanceSettings>) => Promise<void>;
  onUpdateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  onClearAllData?: () => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  categories,
  onUpdateSettings,
  onUpdateCategory,
  onClearAllData
}) => {
  const [botName, setBotName] = useState(settings.botName);
  const [commandPrefix, setCommandPrefix] = useState(settings.commandPrefix);
  const [enableAi, setEnableAi] = useState(settings.enableAiParsing);
  const [targetNumber, setTargetNumber] = useState(settings.targetWhatsAppNumber);

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Category budgets state
  const [budgetMap, setBudgetMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    categories.forEach((c) => {
      map[c.id] = c.monthlyBudget;
    });
    return map;
  });
  const [savedCatId, setSavedCatId] = useState<string | null>(null);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await onUpdateSettings({
        botName,
        commandPrefix,
        enableAiParsing: enableAi,
        targetWhatsAppNumber: targetNumber
      });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveCategoryBudget = async (id: string) => {
    const val = budgetMap[id];
    if (val === undefined || isNaN(val)) return;
    try {
      await onUpdateCategory(id, { monthlyBudget: Number(val) });
      setSavedCatId(id);
      setTimeout(() => setSavedCatId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-400" />
          <span>Configurações do Assistente & Orçamentos</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Ajuste o comportamento do bot WhatsApp, metas financeiras por categoria e preferências gerais.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Bot Configuration */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Identidade e Comportamento do Bot</h2>
          </div>

          <form onSubmit={handleSaveGeneral} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome de Exibição do Assistente
              </label>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="Ex: FinAssist WhatsApp"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Prefixo dos Comandos
              </label>
              <input
                type="text"
                value={commandPrefix}
                onChange={(e) => setCommandPrefix(e.target.value)}
                maxLength={2}
                placeholder="."
                className="w-24 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono font-bold text-center focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Ex: <code className="text-emerald-400 font-mono">{commandPrefix}menu</code>, <code className="text-emerald-400 font-mono">{commandPrefix}gasto</code>
              </span>
            </div>

            {/* AI Parsing Toggle */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Reconhecimento por IA em Linguagem Natural</span>
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Permite aos usuários digitar mensagens como "gastei 50 no posto" sem necessidade de comandos fixos.
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableAi}
                onChange={(e) => setEnableAi(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer ml-3"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Número do WhatsApp para Notificações Automáticas
              </label>
              <input
                type="text"
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                placeholder="Ex: 5511999998888"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-emerald-600/20 transition-all"
            >
              {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            {settingsSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Preferências salvas com sucesso!</span>
              </div>
            )}
          </form>
        </div>

        {/* Category Monthly Budgets Manager */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Tags className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Metas e Limites Mensais de Gastos</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Defina o teto de gastos por categoria para que o bot envie alertas automáticos quando você estiver próximo de estourar a meta.
          </p>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {categories
              .filter((c) => c.name !== 'Salário & Renda')
              .map((cat) => {
                const isSaved = savedCatId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      ></span>
                      <span className="text-xs font-bold text-slate-200">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                          R$
                        </span>
                        <input
                          type="number"
                          value={budgetMap[cat.id] ?? cat.monthlyBudget}
                          onChange={(e) =>
                            setBudgetMap({
                              ...budgetMap,
                              [cat.id]: parseFloat(e.target.value) || 0
                            })
                          }
                          className="w-28 pl-8 pr-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveCategoryBudget(cat.id)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                          isSaved
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white'
                        }`}
                        title="Salvar limite desta categoria"
                      >
                        {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : 'Salvar'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Danger Zone: Clear all saved data */}
      {onClearAllData && (
        <div className="rounded-2xl bg-rose-950/20 border border-rose-900/50 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-rose-300">Zona de Perigo • Reset de Dados</h3>
              </div>
              <p className="text-xs text-slate-400">
                Apaga permanentemente todos os lançamentos financeiros, boletos/dívidas cadastradas e histórico de mensagens para recomeçar o sistema do zero.
              </p>
            </div>

            <div>
              {!showClearConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="px-4 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Apagar Todos os Dados Salvos</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-950 border border-rose-700">
                  <span className="text-xs text-rose-200 font-semibold px-2">Tem certeza absoluta?</span>
                  <button
                    type="button"
                    disabled={isClearingData}
                    onClick={async () => {
                      setIsClearingData(true);
                      try {
                        await onClearAllData();
                        setShowClearConfirm(false);
                      } finally {
                        setIsClearingData(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isClearingData ? 'Apagando...' : 'Sim, Apagar Tudo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
