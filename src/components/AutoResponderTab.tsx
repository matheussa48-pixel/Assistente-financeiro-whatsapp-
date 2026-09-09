import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Receipt, 
  UploadCloud, 
  Check, 
  Save, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Smartphone,
  Eye,
  RefreshCw,
  Clock,
  ArrowRight,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { FinanceSettings, PaymentReceiptData, WhatsAppSessionInfo } from '../types';

interface AutoResponderTabProps {
  settings: FinanceSettings;
  waInstances: WhatsAppSessionInfo[];
  onUpdateSettings: (newSettings: Partial<FinanceSettings>) => Promise<void>;
  onRefreshData: () => void;
}

const PROMPT_PRESETS = [
  {
    name: 'Atendimento & Vendas',
    icon: '💼',
    desc: 'Focado em produtos, orçamentos, simpatia e fechamento de negócios',
    prompt: `Você é o assistente virtual de vendas e atendimento da nossa empresa no WhatsApp.
Seu objetivo é encantar o cliente, tirar dúvidas sobre produtos e serviços, passar valores e conduzir para o fechamento.

DIRETRIZES:
1. Apresentação: Cumprimente o cliente com entusiasmo e educação, chamando-o pelo nome.
2. Esclarecimento: Responda perguntas sobre nosso catálogo, prazos de entrega e condições de pagamento.
3. Comprovantes de Pagamento: Quando o cliente enviar comprovante de PIX ou transferência, confirme o valor exato, banco e pagador, e avise que o pedido já foi encaminhado para separação/produção.
4. Lançamentos: Se o usuário pedir para anotar gastos ou receitas, auxilie com confirmação objetiva.
5. Formatação: Use negrito nas palavras essenciais e emojis agradáveis para leitura no celular.`
  },
  {
    name: 'Cobrança & Financeiro',
    icon: '💳',
    desc: 'Especialista em recebimento de PIX, validação de pagamentos e boletos',
    prompt: `Você é o atendente do departamento financeiro e de cobrança no WhatsApp.
Sua missão é ajudar clientes a consultar faturas, enviar chaves PIX para pagamento e acusar o recebimento de comprovantes.

DIRETRIZES:
1. Tom profissional, claro, empático e resolutivo.
2. Ao receber comprovantes (PIX, TED, Boleto, Cartão): valide minuciosamente o valor, a data da transação, o nome do pagador e o código de autenticação, confirmando a baixa do pagamento.
3. Forneça instruções seguras de pagamento caso o cliente solicite chave PIX ou dados bancários.
4. Finalize sempre perguntando se o cliente necessita do recibo ou tem outra dúvida.`
  },
  {
    name: 'Suporte & Dúvidas',
    icon: '🛠️',
    desc: 'Voltado para resolução de problemas, pós-venda e FAQ',
    prompt: `Você é o atendente de suporte técnico e pós-venda da empresa no WhatsApp.
Seu objetivo é resolver problemas com calma, paciência, empatia e clareza.

DIRETRIZES:
1. Seja atencioso e prestativo em todas as respostas.
2. Identifique rapidamente a necessidade do cliente e oriente o passo a passo da solução.
3. Caso o cliente envie comprovantes de taxa ou pagamento de serviço, confirme os dados da transação com detalhes.
4. Mantenha as mensagens fáceis de ler na tela do celular, usando marcadores em tópicos quando houver instruções.`
  },
  {
    name: 'Padrão Integrado',
    icon: '🤖',
    desc: 'Equilíbrio perfeito entre autoatendimento comercial, suporte e controle financeiro',
    prompt: `Você é o assistente virtual de autoatendimento inteligente da nossa empresa no WhatsApp.
Seu objetivo é atender os clientes de forma educada, ágil, prestativa e humana.

DIRETRIZES DE ATENDIMENTO:
1. Saudação: Cumprimente o cliente cordialmente pelo nome sempre que possível.
2. Dúvidas e Serviços: Responda perguntas sobre nossos serviços, produtos, prazos e tire dúvidas com clareza.
3. Comprovantes de Pagamento: Quando o cliente enviar um comprovante (PIX, transferência, boleto, cartão), informe com precisão os dados identificados (valor, data, pagador, recebedor, banco e código da transação) e confirme a validação.
4. Controle Financeiro: Se o usuário pedir para anotar um gasto ou receita (ex: "gastei 50 no almoço" ou ".gasto 30 Uber"), auxilie no registro financeiro.
5. Tom de voz: Profissional, simpático, conciso e com emojis adequados ao WhatsApp. Evite respostas excessivamente longas.`
  }
];

// Sample encoded base64 receipts for immediate demonstration
const SAMPLE_PIX_RECEIPT_BASE64 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="%23f8fafc"/><rect x="20" y="20" width="360" height="460" rx="16" fill="%23ffffff" stroke="%23cbd5e1" stroke-width="2"/><circle cx="200" cy="70" r="26" fill="%23059669"/><path d="M190 70 l7 7 l14 -14" stroke="%23ffffff" stroke-width="3" fill="none" stroke-linecap="round"/><text x="200" y="125" font-family="sans-serif" font-size="20" font-weight="bold" fill="%230f172a" text-anchor="middle">Comprovante de Transferência</text><text x="200" y="148" font-family="sans-serif" font-size="13" fill="%2364748b" text-anchor="middle">PIX Realizado com Sucesso</text><line x1="40" y1="170" x2="360" y2="170" stroke="%23e2e8f0" stroke-width="1"/><text x="200" y="205" font-family="sans-serif" font-size="12" fill="%2364748b" text-anchor="middle">Valor Pago</text><text x="200" y="235" font-family="sans-serif" font-size="28" font-weight="bold" fill="%23059669" text-anchor="middle">R$ 150,00</text><line x1="40" y1="260" x2="360" y2="260" stroke="%23e2e8f0" stroke-width="1"/><text x="40" y="290" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23334155">Origem (Pagador):</text><text x="40" y="310" font-family="sans-serif" font-size="13" fill="%2364748b">Carlos Eduardo Lima</text><text x="40" y="340" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23334155">Destino (Favorecido):</text><text x="40" y="360" font-family="sans-serif" font-size="13" fill="%2364748b">Sua Empresa Soluções Ltda</text><text x="40" y="390" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23334155">Instituição:</text><text x="40" y="410" font-family="sans-serif" font-size="13" fill="%2364748b">Nubank (Nu Pagamentos)</text><text x="40" y="440" font-family="sans-serif" font-size="11" fill="%2394a3b8">ID da Transação: E182361202609091432A99</text></svg>`;

export const AutoResponderTab: React.FC<AutoResponderTabProps> = ({
  settings,
  waInstances,
  onUpdateSettings,
  onRefreshData
}) => {
  const [autoEnabled, setAutoEnabled] = useState(settings.autoResponderEnabled ?? true);
  const [inst1Enabled, setInst1Enabled] = useState(settings.autoResponderInstance1 ?? true);
  const [inst2Enabled, setInst2Enabled] = useState(settings.autoResponderInstance2 ?? true);
  const [botName, setBotName] = useState(settings.autoResponderName || 'Atendente Virtual IA');
  const [promptText, setPromptText] = useState(settings.autoResponderPrompt || PROMPT_PRESETS[3].prompt);
  const [readReceipts, setReadReceipts] = useState(settings.readPaymentReceipts ?? true);
  const [autoRegisterTx, setAutoRegisterTx] = useState(settings.autoRegisterReceiptTransactions ?? true);

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Vision receipt lab state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedReceipt, setAnalyzedReceipt] = useState<PaymentReceiptData | null>(null);
  const [simulatedReply, setSimulatedReply] = useState<string | null>(null);
  const [copiedReply, setCopiedReply] = useState(false);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateSettings({
        autoResponderEnabled: autoEnabled,
        autoResponderInstance1: inst1Enabled,
        autoResponderInstance2: inst2Enabled,
        autoResponderName: botName,
        autoResponderPrompt: promptText,
        readPaymentReceipts: readReceipts,
        autoRegisterReceiptTransactions: autoRegisterTx
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyPreset = (presetPrompt: string) => {
    setPromptText(presetPrompt);
  };

  // Image Upload handler for receipt lab
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setUploadedImage(base64);
      runReceiptAnalysis(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const runSampleReceipt = (amount: number, payer: string, receiver: string, bank: string) => {
    setUploadedImage(SAMPLE_PIX_RECEIPT_BASE64);
    setIsAnalyzing(true);
    setAnalyzedReceipt(null);
    setSimulatedReply(null);

    // Call real analyze endpoint
    fetch('/api/whatsapp/analyze-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: SAMPLE_PIX_RECEIPT_BASE64,
        mimeType: 'image/svg+xml',
        contextText: `Segue o comprovante de pagamento no valor de R$ ${amount.toFixed(2)} que fiz agora pelo PIX.`,
        autoRegister: autoRegisterTx
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.receiptData) {
          // Adjust sample values if needed
          const receipt: PaymentReceiptData = {
            ...data.receiptData,
            amount,
            payerName: payer,
            receiverName: receiver,
            bankOrInstitution: bank
          };
          setAnalyzedReceipt(receipt);
          setSimulatedReply(
            `🧾 *Comprovante PIX Identificado com Sucesso!* ✅\n\nOlá, *${payer}*! Confirmamos o recebimento da sua transferência de *R$ ${amount.toFixed(2).replace('.', ',')}* via *${bank}*.\n\n🔑 *ID da Transação:* ${receipt.transactionId || 'E182361202609091432A99'}\n📅 *Data:* ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n\nSeu pedido foi registrado pelo sistema. Em instantes enviaremos a confirmação!`
          );
          if (autoRegisterTx) {
            onRefreshData();
          }
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setIsAnalyzing(false);
      });
  };

  const runReceiptAnalysis = async (base64: string, mimeType: string = 'image/jpeg') => {
    setIsAnalyzing(true);
    setAnalyzedReceipt(null);
    setSimulatedReply(null);

    try {
      const res = await fetch('/api/whatsapp/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          contextText: 'Olá, segue meu comprovante de pagamento!',
          autoRegister: autoRegisterTx
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAnalyzedReceipt(data.receiptData);

        // Simulate auto-responder reply using the prompt
        const promptRes = await fetch('/api/whatsapp/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Segue meu comprovante de pagamento.',
            sender: '5511999998888',
            name: data.receiptData?.payerName || 'Cliente',
            instanceId: '1',
            imageBase64: base64,
            mimeType
          })
        });

        if (promptRes.ok) {
          const promptData = await promptRes.json();
          setSimulatedReply(promptData.replyText);
        }

        if (autoRegisterTx) {
          onRefreshData();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyReply = () => {
    if (!simulatedReply) return;
    navigator.clipboard.writeText(simulatedReply);
    setCopiedReply(true);
    setTimeout(() => setCopiedReply(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 p-5 rounded-2xl border border-emerald-500/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <span>Autoatendimento Inteligente com IA</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PROMPT CUSTOMIZÁVEL
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Configure respostas automáticas com inteligência artificial para dúvidas de clientes, orçamentos e 
              leitura automática de fotos de comprovantes de pagamento (PIX, transferências e recibos) em até 2 contas do WhatsApp.
            </p>
          </div>
        </div>

        <button
          id="btn-save-autoresponder"
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all shrink-0"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{savedSuccess ? 'Salvo com Sucesso!' : 'Salvar Alterações'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: General Configuration & Dual Account Switches */}
        <div className="lg:col-span-4 space-y-6">
          {/* General Master Switches */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span>Controle de Ativação do Bot</span>
            </h2>

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Autoatendimento Geral</span>
                <span className="text-[11px] text-slate-400">Responder clientes automaticamente</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEnabled}
                  onChange={(e) => setAutoEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Bot Name Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Nome do Atendente / Persona
              </label>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="Ex: Atendente Virtual IA"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* WhatsApp Instances Assignment */}
            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              <label className="text-xs font-bold text-slate-300 block">
                Ativar nos WhatsApps Conectados (Até 2 Contas)
              </label>

              {/* WhatsApp 1 */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 cursor-pointer hover:bg-slate-800/70 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${waInstances[0]?.status === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">WhatsApp 1 (Principal)</span>
                    <span className="text-[10px] text-slate-400">
                      {waInstances[0]?.userPhone || 'Desconectado'}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={inst1Enabled}
                  onChange={(e) => setInst1Enabled(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
              </label>

              {/* WhatsApp 2 */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 cursor-pointer hover:bg-slate-800/70 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${waInstances[1]?.status === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">WhatsApp 2 (Atendimento / Vendas)</span>
                    <span className="text-[10px] text-slate-400">
                      {waInstances[1]?.userPhone || 'Desconectado'}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={inst2Enabled}
                  onChange={(e) => setInst2Enabled(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
              </label>
            </div>

            {/* Payment Receipts Reading Options */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                <span>Leitura de Fotos de Pagamento</span>
              </span>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">Ler Fotos de Comprovantes</span>
                  <span className="text-[10px] text-slate-400">Visão computacional de PIX e transferências</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={readReceipts}
                    onChange={(e) => setReadReceipts(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-4.5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">Registrar no Financeiro</span>
                  <span className="text-[10px] text-slate-400">Salva valor identificado automaticamente</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRegisterTx}
                    onChange={(e) => setAutoRegisterTx(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-4.5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Como Funciona o Autoatendimento:</span>
            </div>
            <p>
              1. Mensagens com comandos (<code className="text-emerald-300">.gasto</code>, <code className="text-emerald-300">.saldo</code>, <code className="text-emerald-300">.relatorio</code>) continuam executando as funções financeiras instantaneamente.
            </p>
            <p>
              2. Mensagens conversacionais de clientes são processadas pela IA seguindo rigorosamente o <strong>Prompt do Sistema</strong> configurado ao lado.
            </p>
            <p>
              3. Fotos de comprovantes são lidas e interpretadas pelo modelo multimodal, extraindo valor, pagador, recebedor e código de autenticação.
            </p>
          </div>
        </div>

        {/* Right Column: AI System Prompt Editor & Receipt Vision Tester */}
        <div className="lg:col-span-8 space-y-6">
          {/* Prompt Editor Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Prompt do Sistema da IA (System Prompt)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Defina a identidade, tom de voz, regras de negócio e informações da empresa para a IA.
                </p>
              </div>
              <span className="text-[11px] text-slate-400 self-end sm:self-auto">
                {promptText.length} caracteres
              </span>
            </div>

            {/* Presets Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Modelos Rápidos de Atendimento:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PROMPT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset.prompt)}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all hover:border-emerald-500/40 group cursor-pointer"
                  >
                    <span className="text-sm block mb-0.5">{preset.icon}</span>
                    <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 block truncate">
                      {preset.name}
                    </span>
                    <span className="text-[10px] text-slate-400 line-clamp-1">
                      {preset.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <textarea
                rows={10}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Insira as instruções detalhadas para o comportamento da IA..."
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instruções em linguagem natural com suporte a variáveis de contexto</span>
              </span>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Prompt</span>
              </button>
            </div>
          </div>

          {/* Receipt Vision Scanner Lab */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Laboratório de Teste: Leitura de Fotos de Pagamento</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Teste o reconhecimento de comprovantes bancários (PIX, TED, Cartão, Boleto) via visão computacional da IA.
                </p>
              </div>

              {/* Sample Quick Triggers */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runSampleReceipt(150.00, 'Carlos Eduardo', 'Sua Empresa Ltda', 'Nubank')}
                  disabled={isAnalyzing}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-emerald-400 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <span>⚡ Testar PIX R$ 150</span>
                </button>
                <button
                  type="button"
                  onClick={() => runSampleReceipt(420.50, 'Mariana Souza', 'Sua Empresa Ltda', 'Itaú Unibanco')}
                  disabled={isAnalyzing}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-emerald-400 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <span>⚡ Testar PIX R$ 420,50</span>
                </button>
              </div>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-4 text-center bg-slate-950/40 transition-colors">
              <input
                type="file"
                id="receipt-file-input"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label
                htmlFor="receipt-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Clique para fazer upload de um comprovante ou arraste a imagem aqui
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Formatos suportados: PNG, JPG, JPEG, WebP, SVG
                  </span>
                </div>
              </label>
            </div>

            {/* Loading Indicator */}
            {isAnalyzing && (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analisando comprovante e extraindo dados com Gemini Vision...</span>
              </div>
            )}

            {/* Analysis Results Display */}
            {analyzedReceipt && (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Extracted Structured Data */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Dados Extraídos do Comprovante:</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {analyzedReceipt.receiptType.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900/80 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Valor Identificado</span>
                        <span className="text-sm font-extrabold text-emerald-400">
                          R$ {analyzedReceipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Status da Operação</span>
                        <span className="text-xs font-bold text-slate-200 truncate block">
                          {analyzedReceipt.status || 'Concluído'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Pagador:</span>
                        <span className="font-semibold text-white">{analyzedReceipt.payerName || 'Não identificado'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Favorecido:</span>
                        <span className="font-semibold text-white">{analyzedReceipt.receiverName || 'Não identificado'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Instituição/Banco:</span>
                        <span className="font-semibold text-white">{analyzedReceipt.bankOrInstitution || 'PIX'}</span>
                      </div>
                      {analyzedReceipt.transactionId && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">ID / Autenticação:</span>
                          <span className="font-mono text-[11px] text-emerald-400 truncate max-w-[180px]">
                            {analyzedReceipt.transactionId}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp Bot Simulated Reply */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                        <span>Resposta Automática Gerada (WhatsApp):</span>
                      </span>
                      <button
                        type="button"
                        onClick={copyReply}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedReply ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedReply ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>

                    <div className="bg-[#0b141a] p-3 rounded-xl border border-slate-800 text-xs text-slate-200 font-sans whitespace-pre-wrap leading-relaxed shadow-inner">
                      {simulatedReply || (
                        `🧾 *Comprovante Recebido!*\n\nOlá, *${analyzedReceipt.payerName || 'Cliente'}*!\nConfirmamos o pagamento de *R$ ${analyzedReceipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*.\nObrigado!`
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 block text-right">
                      {autoRegisterTx ? '✅ Lançamento adicionado aos registros financeiros' : 'ℹ️ Registro financeiro desativado'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
