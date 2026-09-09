import React, { useState } from 'react';
import { 
  Smartphone, 
  QrCode, 
  RefreshCw, 
  Power, 
  CheckCircle2, 
  AlertCircle, 
  PhoneCall, 
  Copy, 
  Check, 
  History, 
  Trash2,
  Send,
  ShieldCheck,
  Zap,
  Info,
  Receipt,
  Eye,
  Filter
} from 'lucide-react';
import { WhatsAppSessionInfo, WhatsAppMessageLog, WhatsAppInstanceId } from '../types';

interface WhatsAppTabProps {
  waInstances: WhatsAppSessionInfo[];
  logs: WhatsAppMessageLog[];
  isConnecting: boolean;
  onConnect: (instanceId?: WhatsAppInstanceId) => void;
  onDisconnect: (instanceId?: WhatsAppInstanceId) => void;
  onRequestPairingCode: (phone: string, instanceId: WhatsAppInstanceId) => Promise<string | null>;
  onRefreshLogs: () => void;
  onClearLogs: () => void;
  onSendManualMessage: (to: string, text: string, instanceId: WhatsAppInstanceId) => Promise<void>;
}

export const WhatsAppTab: React.FC<WhatsAppTabProps> = ({
  waInstances,
  logs,
  isConnecting,
  onConnect,
  onDisconnect,
  onRequestPairingCode,
  onRefreshLogs,
  onClearLogs,
  onSendManualMessage
}) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState<WhatsAppInstanceId | 'both'>('1');
  const [phoneNumber1, setPhoneNumber1] = useState('');
  const [phoneNumber2, setPhoneNumber2] = useState('');
  const [pairingCode1, setPairingCode1] = useState<string | null>(null);
  const [pairingCode2, setPairingCode2] = useState<string | null>(null);
  const [isPairingLoading1, setIsPairingLoading1] = useState(false);
  const [isPairingLoading2, setIsPairingLoading2] = useState(false);
  const [pairingError1, setPairingError1] = useState<string | null>(null);
  const [pairingError2, setPairingError2] = useState<string | null>(null);
  const [copiedCode1, setCopiedCode1] = useState(false);
  const [copiedCode2, setCopiedCode2] = useState(false);

  // Manual test send form
  const [sendInstanceId, setSendInstanceId] = useState<WhatsAppInstanceId>('1');
  const [testRecipient, setTestRecipient] = useState('');
  const [testText, setTestText] = useState('Olá! Seu assistente de finanças está conectado e pronto para uso.');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Log filter
  const [logFilter, setLogFilter] = useState<'all' | '1' | '2'>('all');
  const [selectedLogReceipt, setSelectedLogReceipt] = useState<WhatsAppMessageLog | null>(null);

  const inst1 = waInstances[0] || {
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
  };

  const inst2 = waInstances[1] || {
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
  };

  const handleGeneratePairing1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber1) return;
    setIsPairingLoading1(true);
    setPairingError1(null);
    try {
      const code = await onRequestPairingCode(phoneNumber1, '1');
      if (code) setPairingCode1(code);
    } catch (err: any) {
      setPairingError1(err.message || 'Erro ao gerar código de pareamento');
    } finally {
      setIsPairingLoading1(false);
    }
  };

  const handleGeneratePairing2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber2) return;
    setIsPairingLoading2(true);
    setPairingError2(null);
    try {
      const code = await onRequestPairingCode(phoneNumber2, '2');
      if (code) setPairingCode2(code);
    } catch (err: any) {
      setPairingError2(err.message || 'Erro ao gerar código de pareamento');
    } finally {
      setIsPairingLoading2(false);
    }
  };

  const copyPairingCode = (code: string | null, which: '1' | '2') => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    if (which === '1') {
      setCopiedCode1(true);
      setTimeout(() => setCopiedCode1(false), 2000);
    } else {
      setCopiedCode2(true);
      setTimeout(() => setCopiedCode2(false), 2000);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient || !testText) return;
    setIsSending(true);
    try {
      await onSendManualMessage(testRecipient, testText, sendInstanceId);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.instanceId === logFilter || (!log.instanceId && logFilter === '1');
  });

  const renderInstanceCard = (
    instance: WhatsAppSessionInfo,
    phoneNumber: string,
    setPhoneNumber: (val: string) => void,
    handleGeneratePairing: (e: React.FormEvent) => void,
    isPairingLoading: boolean,
    pairingCode: string | null,
    copyPairing: () => void,
    copied: boolean,
    pairingError: string | null
  ) => {
    const isConnected = instance.status === 'connected';
    const isQrReady = instance.status === 'qr_ready';
    const displayPairing = pairingCode || instance.pairingCode;

    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between space-y-5">
        <div>
          {/* Header of instance */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400' : isQrReady ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
              <div>
                <h3 className="text-sm font-bold text-white">{instance.instanceName}</h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {instance.userPhone ? `📱 ${instance.userPhone}` : 'Sem número vinculado'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isConnected ? (
                <button
                  type="button"
                  onClick={() => onDisconnect(instance.instanceId)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onConnect(instance.instanceId)}
                  disabled={isConnecting}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-emerald-600/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                  <span>{isConnecting ? 'Conectando...' : 'Iniciar'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Connected State View */}
          {isConnected && (
            <div className="mt-4 p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Instância Online e Ativa!</h4>
              <p className="text-xs text-slate-300">
                Número: <span className="text-emerald-400 font-mono font-bold">{instance.userPhone}</span>
              </p>
              {instance.userName && (
                <p className="text-[11px] text-slate-400">Nome da Conta: {instance.userName}</p>
              )}
              <p className="text-[11px] text-emerald-400/80 pt-1">
                ✅ Recebendo mensagens, fotos de comprovantes e respondendo automaticamente.
              </p>
            </div>
          )}

          {/* QR Code view if available and not connected */}
          {!isConnected && isQrReady && instance.qrCodeDataUrl && (
            <div className="mt-4 flex flex-col items-center text-center space-y-3">
              <div className="p-2.5 bg-white rounded-2xl shadow-xl border-4 border-emerald-500/30 inline-block">
                <img
                  src={instance.qrCodeDataUrl}
                  alt="WhatsApp QR Code Baileys"
                  className="w-48 h-48 rounded-lg object-contain"
                />
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar Aparelho e aponte a câmera.
              </p>
            </div>
          )}

          {/* Disconnected state placeholder */}
          {!isConnected && !isQrReady && (
            <div className="mt-4 p-5 rounded-xl bg-slate-800/40 border border-slate-800 text-center space-y-2">
              <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <QrCode className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-white">Sessão Desconectada</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Inicie o socket para exibir o QR Code ou solicite um código de 8 dígitos abaixo.
              </p>
            </div>
          )}

          {/* Pairing Code Section */}
          <div className="mt-5 pt-4 border-t border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conectar por Código de Pareamento</span>
            </span>

            <form onSubmit={handleGeneratePairing} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ex: 5511999998888 ou 11999998888"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={isPairingLoading || !phoneNumber}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
                >
                  {isPairingLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{isPairingLoading ? 'Gerando...' : 'Obter Código'}</span>
                </button>
              </div>

              {displayPairing && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-300 block font-semibold">CÓDIGO DE PAREAMENTO:</span>
                    <span className="text-base font-mono font-extrabold text-white tracking-widest">
                      {displayPairing}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyPairing}
                    className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {pairingError && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pairingError}</span>
                </p>
              )}
            </form>
          </div>
        </div>

        {instance.lastError && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{instance.lastError}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <span>Conexão WhatsApp (Baileys Dual-Instance)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Conecte até <strong>2 números de WhatsApp</strong> simultaneamente sem APIs pagas de terceiros.
          </p>
        </div>

        {/* Global Connection Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onConnect()}
            disabled={isConnecting}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
            <span>Conectar Ambas</span>
          </button>
          <button
            type="button"
            onClick={() => onDisconnect()}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Desconectar Todas</span>
          </button>
        </div>
      </div>

      {/* Instance Tabs Switcher */}
      <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setSelectedInstanceId('1')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
            selectedInstanceId === '1' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${inst1.status === 'connected' ? 'bg-emerald-300' : 'bg-slate-500'}`} />
          <span>WhatsApp 1 (Principal)</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedInstanceId('2')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
            selectedInstanceId === '2' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${inst2.status === 'connected' ? 'bg-emerald-300' : 'bg-slate-500'}`} />
          <span>WhatsApp 2 (Atendimento)</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedInstanceId('both')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            selectedInstanceId === 'both' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Lado a Lado (2 Contas)</span>
        </button>
      </div>

      {/* Dual Cards Grid */}
      <div className={`grid gap-6 ${selectedInstanceId === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-2xl'}`}>
        {(selectedInstanceId === '1' || selectedInstanceId === 'both') &&
          renderInstanceCard(
            inst1,
            phoneNumber1,
            setPhoneNumber1,
            handleGeneratePairing1,
            isPairingLoading1,
            pairingCode1,
            () => copyPairingCode(pairingCode1 || inst1.pairingCode, '1'),
            copiedCode1,
            pairingError1
          )}

        {(selectedInstanceId === '2' || selectedInstanceId === 'both') &&
          renderInstanceCard(
            inst2,
            phoneNumber2,
            setPhoneNumber2,
            handleGeneratePairing2,
            isPairingLoading2,
            pairingCode2,
            () => copyPairingCode(pairingCode2 || inst2.pairingCode, '2'),
            copiedCode2,
            pairingError2
          )}
      </div>

      {/* Manual Message Dispatch */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Disparo Manual de Mensagem</h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Envie uma mensagem direta escolhendo qual WhatsApp utilizar
          </span>
        </div>

        <form onSubmit={handleSendTestMessage} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Enviar a Partir De:
            </label>
            <select
              value={sendInstanceId}
              onChange={(e) => setSendInstanceId(e.target.value as WhatsAppInstanceId)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="1">WhatsApp 1 ({inst1.status === 'connected' ? 'Online' : 'Offline'})</option>
              <option value="2">WhatsApp 2 ({inst2.status === 'connected' ? 'Online' : 'Offline'})</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Destinatário (DDI + DDD + Telefone)
            </label>
            <input
              type="text"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="Ex: 5511999998888"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Mensagem
            </label>
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Texto da mensagem..."
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={isSending || !testRecipient || !testText}
              className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{isSending ? 'Enviando...' : 'Enviar'}</span>
            </button>
          </div>
        </form>

        {sendSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Mensagem enviada com sucesso pelo WhatsApp {sendInstanceId}!</span>
          </div>
        )}
      </div>

      {/* Message Logs Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Histórico de Mensagens Recentes</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
              {filteredLogs.length} logs
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter by instance */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              <Filter className="w-3 h-3 text-slate-400 ml-1" />
              <button
                type="button"
                onClick={() => setLogFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${logFilter === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('1')}
                className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${logFilter === '1' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
              >
                WA 1
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('2')}
                className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${logFilter === '2' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
              >
                WA 2
              </button>
            </div>

            <button
              onClick={onRefreshLogs}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer transition-colors"
              title="Atualizar Logs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClearLogs}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs cursor-pointer transition-colors"
              title="Limpar Logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center text-xs text-slate-400">
            Nenhuma mensagem registrada ainda. Envie uma mensagem pelo WhatsApp ou use o simulador para testar!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Horário</th>
                  <th className="py-2.5 px-3">Instância</th>
                  <th className="py-2.5 px-3">Direção</th>
                  <th className="py-2.5 px-3">Contato</th>
                  <th className="py-2.5 px-3">Mensagem</th>
                  <th className="py-2.5 px-3">Comprovante / Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredLogs.map((log) => {
                  const dateStr = new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.instanceId === '2' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' :
                          'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          WA {log.instanceId || '1'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          log.direction === 'incoming' ? 'bg-blue-500/15 text-blue-300' : 'bg-emerald-500/15 text-emerald-300'
                        }`}>
                          {log.direction === 'incoming' ? '← Entrada' : '→ Resposta'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap font-medium">
                        {log.senderName || log.from}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-md">
                        <p className="line-clamp-2">{log.text}</p>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {log.receiptData ? (
                          <button
                            type="button"
                            onClick={() => setSelectedLogReceipt(log)}
                            className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>R$ {log.receiptData.amount.toFixed(2)}</span>
                          </button>
                        ) : log.transactionCreated ? (
                          <span className="text-[11px] text-emerald-400 font-medium">
                            +{log.transactionCreated.amount ? `R$ ${log.transactionCreated.amount}` : 'Lançado'}
                          </span>
                        ) : log.commandDetected ? (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {log.commandDetected}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Details Modal */}
      {selectedLogReceipt && selectedLogReceipt.receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Comprovante de Pagamento Reconhecido</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedLogReceipt(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl space-y-1.5 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tipo:</span>
                  <span className="font-bold text-emerald-400 uppercase">{selectedLogReceipt.receiptData.receiptType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Valor:</span>
                  <span className="font-bold text-white text-sm">
                    R$ {selectedLogReceipt.receiptData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pagador:</span>
                  <span className="font-medium text-white">{selectedLogReceipt.receiptData.payerName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Favorecido:</span>
                  <span className="font-medium text-white">{selectedLogReceipt.receiptData.receiverName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Banco:</span>
                  <span className="font-medium text-white">{selectedLogReceipt.receiptData.bankOrInstitution || 'N/A'}</span>
                </div>
                {selectedLogReceipt.receiptData.transactionId && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Autenticação/ID:</span>
                    <span className="font-mono text-[10px] text-emerald-300 truncate max-w-[180px]">
                      {selectedLogReceipt.receiptData.transactionId}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                {selectedLogReceipt.receiptData.summary}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogReceipt(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
