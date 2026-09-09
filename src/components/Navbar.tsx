import React from 'react';
import { 
  Wallet, 
  LayoutDashboard, 
  Smartphone, 
  MessageSquareCode, 
  Receipt, 
  FileSpreadsheet, 
  Settings,
  RefreshCw,
  Sparkles,
  Bot,
  Briefcase
} from 'lucide-react';
import { WhatsAppSessionInfo } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  waInstances: WhatsAppSessionInfo[];
  onRefreshStatus: () => void;
  isConnecting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  waInstances,
  onRefreshStatus,
  isConnecting
}) => {
  const inst1 = waInstances[0];
  const inst2 = waInstances[1];

  const tabs = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { 
      id: 'debts', 
      label: 'Boletos & Contador IA', 
      icon: Briefcase,
      highlight: true
    },
    { 
      id: 'whatsapp', 
      label: 'WhatsApp (2 Contas)', 
      icon: Smartphone, 
      badge: (inst1?.status === 'connected' || inst2?.status === 'connected') ? 'Online' : undefined 
    },
    { 
      id: 'autoresponder', 
      label: 'Autoatendimento IA', 
      icon: Sparkles
    },
    { id: 'simulator', label: 'Simulador WhatsApp', icon: MessageSquareCode },
    { id: 'transactions', label: 'Lançamentos', icon: Receipt },
    { id: 'reports', label: 'Relatórios Mensais', icon: FileSpreadsheet },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const renderSingleInstancePill = (inst?: WhatsAppSessionInfo, num: string = '1') => {
    if (!inst) return null;
    const isConn = inst.status === 'connected';
    const isQr = inst.status === 'qr_ready';
    return (
      <div 
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
          isConn 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : isQr
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isConn ? 'bg-emerald-400 animate-pulse' : isQr ? 'bg-amber-400' : 'bg-slate-500'}`} />
        <span>WA {num}:</span>
        <span className="font-normal text-[10px]">
          {isConn ? (inst.userPhone ? inst.userPhone.slice(-4) : 'Online') : isQr ? 'QR' : 'Off'}
        </span>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">FinAssist</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  DUAL WHATSAPP + IA
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Gestão Financeira & Autoatendimento Multimodal</p>
            </div>
          </div>

          {/* Connection Status of Both Accounts & Refresh */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className="flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-102"
              title="Clique para gerenciar conexões do WhatsApp"
            >
              {renderSingleInstancePill(inst1, '1')}
              {renderSingleInstancePill(inst2, '2')}
            </button>

            <button
              onClick={onRefreshStatus}
              disabled={isConnecting}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
              title="Atualizar status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto no-scrollbar py-2 border-t border-slate-800/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : tab.highlight
                    ? 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive || tab.highlight ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
