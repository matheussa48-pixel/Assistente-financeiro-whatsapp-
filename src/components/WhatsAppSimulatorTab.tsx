import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Smartphone, 
  Trash2, 
  CheckCheck, 
  ShieldCheck, 
  Bot, 
  Info,
  ChevronRight,
  Smile,
  Paperclip,
  Image as ImageIcon,
  Receipt,
  RefreshCw,
  Camera,
  X
} from 'lucide-react';
import { BotProcessResult } from '../../server/botEngine';
import { WhatsAppInstanceId, PaymentReceiptData } from '../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  commandDetected?: string;
  imageBase64?: string;
  receiptData?: PaymentReceiptData;
}

interface WhatsAppSimulatorTabProps {
  onSimulateMessage: (
    text: string, 
    instanceId?: WhatsAppInstanceId, 
    imageBase64?: string, 
    mimeType?: string
  ) => Promise<BotProcessResult>;
  onRefreshData: () => void;
}

const SAMPLE_RECEIPT_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" viewBox="0 0 360 420"><rect width="360" height="420" fill="%23ffffff" rx="12" stroke="%23cbd5e1" stroke-width="2"/><circle cx="180" cy="55" r="22" fill="%2310b981"/><path d="M172 55 l6 6 l12 -12" stroke="%23ffffff" stroke-width="3" fill="none" stroke-linecap="round"/><text x="180" y="105" font-family="sans-serif" font-size="16" font-weight="bold" fill="%230f172a" text-anchor="middle">Comprovante PIX</text><text x="180" y="125" font-family="sans-serif" font-size="12" fill="%2364748b" text-anchor="middle">Pagamento Aprovado</text><line x1="30" y1="145" x2="330" y2="145" stroke="%23e2e8f0" stroke-width="1"/><text x="180" y="180" font-family="sans-serif" font-size="11" fill="%2364748b" text-anchor="middle">Valor da Transferência</text><text x="180" y="210" font-family="sans-serif" font-size="24" font-weight="bold" fill="%23059669" text-anchor="middle">R$ 180,00</text><line x1="30" y1="230" x2="330" y2="230" stroke="%23e2e8f0" stroke-width="1"/><text x="30" y="260" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23334155">Pagador:</text><text x="30" y="280" font-family="sans-serif" font-size="12" fill="%2364748b">Renata Silveira</text><text x="30" y="310" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23334155">Favorecido:</text><text x="30" y="330" font-family="sans-serif" font-size="12" fill="%2364748b">FinAssist Atendimento</text><text x="30" y="360" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23334155">Banco:</text><text x="30" y="380" font-family="sans-serif" font-size="12" fill="%2364748b">Banco Inter S.A.</text></svg>`;

export const WhatsAppSimulatorTab: React.FC<WhatsAppSimulatorTabProps> = ({
  onSimulateMessage,
  onRefreshData
}) => {
  const [activeInstance, setActiveInstance] = useState<WhatsAppInstanceId>('1');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-bot',
      sender: 'bot',
      text: `👋 Olá! Sou seu assistente no WhatsApp com Autoatendimento IA.\n\n• Envie comandos como *.saldo*, *.extrato* ou *.gasto 35 lanche*\n• Faça perguntas sobre produtos e serviços\n• Ou envie uma foto/comprovante de pagamento PIX para leitura imediata!`,
      timestamp: '10:00'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>('image/jpeg');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const quickCommands = [
    { label: '.boleto 150 Luz 20/09', cmd: '.boleto 150.00 Conta de Luz Enel 20/09', desc: 'Lançar Boleto' },
    { label: '.boletos', cmd: '.boletos', desc: 'Listar Contas' },
    { label: '.contador', cmd: '.contador', desc: 'Ordem Prioritária IA' },
    { label: '.pagar Luz', cmd: '.pagar Luz', desc: 'Quitar Boleto' },
    { label: 'Comprovante PIX', isReceipt: true, desc: 'Enviar Foto PIX' },
    { label: '.menu', cmd: '.menu', desc: 'Menu Geral' },
    { label: '.saldo', cmd: '.saldo', desc: 'Ver Saldo' },
    { label: 'Qual dívida pagar 1º?', cmd: 'Quais dívidas devo pagar primeiro com meu saldo atual?', desc: 'Contador IA Natural' },
    { label: '.gasto 52 almoço', cmd: '.gasto 52.00 Almoço Executivo', desc: 'Registrar Gasto' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      setSelectedImageMime(file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const attachSampleReceipt = () => {
    setSelectedImage(SAMPLE_RECEIPT_SVG);
    setSelectedImageMime('image/svg+xml');
    if (!inputText) {
      setInputText('Segue meu comprovante de pagamento do pedido!');
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if ((!text && !selectedImage) || isProcessing) return;

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text || (selectedImage ? '[Foto do Comprovante]' : ''),
      timestamp: time,
      imageBase64: selectedImage || undefined
    };

    const imageToSend = selectedImage;
    const mimeToSend = selectedImageMime;

    setMessages((prev) => [...prev, userMsg]);
    if (textToSend === undefined) setInputText('');
    setSelectedImage(null);
    setIsProcessing(true);

    try {
      const result = await onSimulateMessage(
        text, 
        activeInstance, 
        imageToSend || undefined, 
        mimeToSend
      );

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: result.replyText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        commandDetected: result.commandDetected,
        receiptData: result.receiptData
      };
      setMessages((prev) => [...prev, botMsg]);
      onRefreshData();
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'bot',
        text: `⚠️ Desculpe, ocorreu um erro ao processar sua mensagem: ${err.message || 'Erro de conexão'}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-bot',
        sender: 'bot',
        text: `Conversa reiniciada. Teste enviando um comprovante ou uma pergunta ao autoatendimento!`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <span>Simulador Interativo do WhatsApp</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Teste respostas do autoatendimento, comandos e leitura de fotos de comprovante em tempo real sem precisar de celular.
          </p>
        </div>

        {/* Instance Selector & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <span className="text-[11px] text-slate-400 pl-2">Testando em:</span>
            <button
              type="button"
              onClick={() => setActiveInstance('1')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                activeInstance === '1' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              WhatsApp 1
            </button>
            <button
              type="button"
              onClick={() => setActiveInstance('2')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                activeInstance === '2' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              WhatsApp 2
            </button>
          </div>

          <button
            onClick={handleClearChat}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Limpar Conversa"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpar</span>
          </button>
        </div>
      </div>

      {/* Main Sandbox Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Quick Commands & Prompts Bar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Testes Rápidos de Autoatendimento</span>
              </span>
            </div>

            <div className="space-y-1.5">
              {quickCommands.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (item.isReceipt) {
                      attachSampleReceipt();
                    } else if (item.cmd) {
                      handleSendMessage(item.cmd);
                    }
                  }}
                  disabled={isProcessing}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/40 text-xs text-slate-200 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    {item.isReceipt ? (
                      <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 group-hover:scale-125 transition-transform" />
                    )}
                    <div>
                      <span className="font-semibold text-white group-hover:text-emerald-300 block">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{item.desc}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Receipt className="w-4 h-4" />
              <span>Dica: Leitura de Comprovantes</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Clique no ícone de <strong>clipe</strong> ou <strong>câmera</strong> abaixo para enviar qualquer imagem de comprovante. O Gemini Vision extrairá valor, pagador, recebedor e banco, respondendo conforme o seu prompt configurado!
            </p>
          </div>
        </div>

        {/* WhatsApp Phone Mockup & Chat Container */}
        <div className="lg:col-span-8 flex justify-center">
          <div className="w-full max-w-lg bg-[#0b141a] rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[640px]">
            {/* WhatsApp Header */}
            <div className="bg-[#1f2c34] px-4 py-3 flex items-center justify-between border-b border-slate-800 text-white">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-sm text-white">
                    FA
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#1f2c34] rounded-full"></span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">FinAssist Autoatendimento</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      WA {activeInstance}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">online • IA Ativa</span>
                </div>
              </div>
            </div>

            {/* WhatsApp Messages Scroll Body */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{
                backgroundImage: `radial-gradient(#1e293b 1px, transparent 1px)`,
                backgroundSize: '16px 16px'
              }}
            >
              {messages.map((msg) => {
                const isBot = msg.sender === 'bot';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed relative shadow-md ${
                        isBot
                          ? 'bg-[#1f2c34] text-slate-100 rounded-tl-none border border-slate-700/40'
                          : 'bg-[#005c4b] text-white rounded-tr-none'
                      }`}
                    >
                      {/* Attached receipt image if sent by user */}
                      {msg.imageBase64 && (
                        <div className="mb-2 rounded-xl overflow-hidden border border-slate-600 bg-white/5 max-h-48 flex items-center justify-center">
                          <img
                            src={msg.imageBase64}
                            alt="Comprovante"
                            className="max-h-48 object-contain"
                          />
                        </div>
                      )}

                      {/* Message Text */}
                      <div className="whitespace-pre-wrap font-sans break-words">
                        {msg.text}
                      </div>

                      {/* Receipt Extraction Badge */}
                      {msg.receiptData && (
                        <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px]">
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Receipt className="w-3 h-3" />
                            <span>Comprovante: R$ {msg.receiptData.amount.toFixed(2)}</span>
                          </span>
                          <span className="text-slate-400">
                            {msg.receiptData.bankOrInstitution}
                          </span>
                        </div>
                      )}

                      {/* Timestamp & double check */}
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400 select-none">
                        <span>{msg.timestamp}</span>
                        {!isBot && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex items-start">
                  <div className="bg-[#1f2c34] text-slate-300 rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Lendo mensagem & gerando resposta com IA...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Attached Image Preview Bar before sending */}
            {selectedImage && (
              <div className="bg-[#182229] px-4 py-2 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-500/40 bg-white/10 flex items-center justify-center">
                    <img src={selectedImage} alt="Anexo" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs text-emerald-300 font-medium">
                    Foto do comprovante anexada
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* WhatsApp Input Bar */}
            <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2 border-t border-slate-800">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full hover:bg-slate-700/60 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                title="Anexar Comprovante / Foto"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={attachSampleReceipt}
                className="p-2 rounded-full hover:bg-slate-700/60 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                title="Comprovante PIX Exemplo"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={selectedImage ? "Digite uma legenda (opcional)..." : "Digite uma mensagem ou comando..."}
                className="flex-1 bg-[#2a3942] text-white text-xs px-3.5 py-2.5 rounded-xl border border-transparent focus:outline-none focus:border-emerald-500 placeholder-slate-400"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={(!inputText.trim() && !selectedImage) || isProcessing}
                className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#029070] active:scale-95 disabled:opacity-40 text-white transition-all cursor-pointer flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
