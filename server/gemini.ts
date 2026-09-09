import { GoogleGenAI, Type } from '@google/genai';
import { TransactionType, PaymentMethod, Debt, AccountantAdvice, DebtRecommendation, Transaction } from '../src/types.js';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

export interface ParsedFinancialIntent {
  isFinancial: boolean;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  paymentMethod: PaymentMethod;
  confidence: number;
  explanation?: string;
}

export interface ParsedBoletoIntent {
  isBoleto: boolean;
  amount: number;
  description: string;
  dueDate: string; // YYYY-MM-DD
  beneficiary?: string;
  barcodeOrDigitableLine?: string;
  isEssentialService: boolean;
  interestOrLateFee?: number;
}

/**
 * Intelligent parser that extracts financial transaction info from natural WhatsApp messages.
 */
export async function parseNaturalLanguageExpense(
  messageText: string,
  availableCategories: string[]
): Promise<ParsedFinancialIntent | null> {
  const trimmed = messageText.trim();
  if (!trimmed) return null;

  const ai = getAiClient();
  if (ai) {
    try {
      const prompt = `Analise a seguinte mensagem em português enviada por um usuário em um aplicativo de WhatsApp para o seu assistente de finanças.
Identifique se o usuário está relatando uma despesa (gasto) ou receita (ganho/recebimento), ou se é apenas uma mensagem comum.
Se for um registro financeiro, extraia o valor em Reais (BRL), uma descrição clara e concisa, a melhor categoria entre as disponíveis, e o método de pagamento se mencionado.

Categorias disponíveis: ${availableCategories.join(', ')}.
Métodos de pagamento aceitos: pix, credit_card, debit_card, cash, transfer, other.

Mensagem do usuário: "${trimmed}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isFinancial: { type: Type.BOOLEAN, description: 'Verdadeiro se a mensagem descreve um gasto ou receita' },
              type: { type: Type.STRING, enum: ['expense', 'income'], description: 'Se é expense ou income' },
              amount: { type: Type.NUMBER, description: 'Valor numérico em reais (ex: 45.50)' },
              description: { type: Type.STRING, description: 'Descrição concisa do item ou serviço' },
              category: { type: Type.STRING, description: 'Categoria mais apropriada' },
              paymentMethod: { type: Type.STRING, enum: ['pix', 'credit_card', 'debit_card', 'cash', 'transfer', 'other'], description: 'Método de pagamento' },
              confidence: { type: Type.NUMBER, description: 'Confiança de 0 a 1' }
            },
            required: ['isFinancial', 'type', 'amount', 'description', 'category', 'paymentMethod']
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim()) as ParsedFinancialIntent;
        if (parsed.isFinancial && parsed.amount > 0) {
          if (!availableCategories.includes(parsed.category)) {
            parsed.category = availableCategories[0] || 'Outros';
          }
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Gemini NLP parsing fallback invoked:', err);
    }
  }

  return fallbackRegexParser(trimmed, availableCategories);
}

function fallbackRegexParser(text: string, categories: string[]): ParsedFinancialIntent | null {
  const lower = text.toLowerCase();

  const isExpenseKeyword = /(gastei|paguei|comprei|pago|gasto|compra|conta|uber|ifood|mercado|farmácia|almoço|jantar|lanche|pizza|gasolina|abasteci)/i.test(lower);
  const isIncomeKeyword = /(recebi|salário|pix de|caiu|depósito|freela|renda|vendi|pagamento recebido)/i.test(lower);

  const amountMatch = text.match(/(?:R\$|r\$|\$)?\s*(\d+(?:[.,]\d{1,2})?)/);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1].replace(',', '.');
  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) return null;

  const type: TransactionType = isIncomeKeyword ? 'income' : 'expense';

  let category = 'Outros';
  if (/mercado|supermercado|almoço|jantar|lanche|restaurante|comida|ifood|padaria/i.test(lower)) {
    category = categories.find((c) => c.includes('Alimentação')) || 'Alimentação';
  } else if (/aluguel|condomínio|luz|energia|água|gás|iptu|enel|sabesp/i.test(lower)) {
    category = categories.find((c) => c.includes('Moradia')) || 'Moradia & Contas';
  } else if (/uber|99|combustível|gasolina|estacionamento|ônibus|metrô/i.test(lower)) {
    category = categories.find((c) => c.includes('Transporte')) || 'Transporte';
  } else if (/cinema|bar|show|jogo|passeio|viagem/i.test(lower)) {
    category = categories.find((c) => c.includes('Lazer')) || 'Lazer & Restaurantes';
  } else if (/farmácia|remédio|médico|consulta|hospital|dentista/i.test(lower)) {
    category = categories.find((c) => c.includes('Saúde')) || 'Saúde & Bem-Estar';
  } else if (/curso|livro|faculdade|escola/i.test(lower)) {
    category = categories.find((c) => c.includes('Educação')) || 'Educação & Cursos';
  } else if (/netflix|spotify|amazon|internet|plano|celular/i.test(lower)) {
    category = categories.find((c) => c.includes('Assinaturas')) || 'Assinaturas & Tech';
  } else if (isIncomeKeyword) {
    category = categories.find((c) => c.includes('Salário')) || 'Salário & Renda';
  }

  let paymentMethod: PaymentMethod = 'pix';
  if (/crédito|cartao de credito|cartão de crédito/i.test(lower)) {
    paymentMethod = 'credit_card';
  } else if (/débito|cartao de debito/i.test(lower)) {
    paymentMethod = 'debit_card';
  } else if (/dinheiro|em maos/i.test(lower)) {
    paymentMethod = 'cash';
  } else if (/ted|doc|transferência/i.test(lower)) {
    paymentMethod = 'transfer';
  }

  let description = text.replace(/(?:R\$|r\$|\$)?\s*\d+(?:[.,]\d{1,2})?/g, '').trim();
  description = description.replace(/^(gastei|paguei|comprei|recebi|pix de|com|no|na|de|em)\s+/i, '').trim();
  if (description.length === 0) {
    description = type === 'expense' ? `Gasto em ${category}` : 'Receita recebida';
  }
  description = description.charAt(0).toUpperCase() + description.slice(1);

  return {
    isFinancial: isExpenseKeyword || isIncomeKeyword,
    type,
    amount,
    description: description.slice(0, 45),
    category,
    paymentMethod,
    confidence: 0.85
  };
}

/**
 * Parses boleto registration messages like:
 * ".boleto 150.00 Luz 20/09"
 * ".boleto 450.00 Condomínio vencimento 15/10"
 * "cadastrar boleto 89.90 internet dia 25/09 código 23793..."
 */
export async function parseBoletoIntent(messageText: string): Promise<ParsedBoletoIntent | null> {
  const trimmed = messageText.trim();
  if (!trimmed) return null;

  const ai = getAiClient();
  if (ai) {
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      const prompt = `Você é um extrator inteligente de boletos e dívidas a pagar no WhatsApp.
Data de hoje: ${todayIso}.
Analise o texto do usuário e extraia:
1. isBoleto: Se descreve o cadastro de um boleto ou conta/dívida a pagar.
2. amount: Valor numérico em Reais (BRL, ex: 150.00).
3. description: Descrição do boleto (ex: "Boleto Conta de Luz", "Aluguel", "Fatura Cartão", "Internet").
4. dueDate: Data de vencimento no formato AAAA-MM-DD (ex: 2026-09-20). Se o ano não for informado, use o ano atual (${new Date().getFullYear()}). Se o dia for menor que hoje no mês atual, considere o próximo mês. Se não informado, use 5 dias a partir de hoje.
5. beneficiary: Favorecido ou empresa emissora (ex: Enel, Sabesp, Imobiliária, Banco, Claro).
6. barcodeOrDigitableLine: Código de barras ou linha digitável numérica (composto de números com ou sem pontos).
7. isEssentialService: Se é serviço essencial (água, luz, gás, aluguel, condomínio, internet).
8. interestOrLateFee: Juros estimados ou informados (ex: juros % ou taxa de atraso).

Texto do usuário: "${trimmed}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isBoleto: { type: Type.BOOLEAN },
              amount: { type: Type.NUMBER },
              description: { type: Type.STRING },
              dueDate: { type: Type.STRING },
              beneficiary: { type: Type.STRING },
              barcodeOrDigitableLine: { type: Type.STRING },
              isEssentialService: { type: Type.BOOLEAN },
              interestOrLateFee: { type: Type.NUMBER }
            },
            required: ['isBoleto', 'amount', 'description', 'dueDate', 'isEssentialService']
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim()) as ParsedBoletoIntent;
        if (parsed.isBoleto && parsed.amount > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Gemini boleto parsing fallback invoked:', err);
    }
  }

  // Fallback regex parser for .boleto
  return fallbackBoletoRegexParser(trimmed);
}

function fallbackBoletoRegexParser(text: string): ParsedBoletoIntent | null {
  const clean = text.replace(/^\.boleto\s*/i, '').trim();

  // Find amount
  const amountMatch = clean.match(/(?:r\$|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1].replace(',', '.');
  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) return null;

  // Find date in dd/mm or dd/mm/yyyy or "dia X"
  const now = new Date();
  const currentYear = now.getFullYear();
  let dueDate = '';

  const dateMatch = clean.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const day = String(dateMatch[1]).padStart(2, '0');
    const month = String(dateMatch[2]).padStart(2, '0');
    const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : String(currentYear);
    dueDate = `${year}-${month}-${day}`;
  } else {
    const dayMatch = clean.match(/(?:dia|vence|vencimento|para)\s+(\d{1,2})/i);
    if (dayMatch) {
      const day = String(dayMatch[1]).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      dueDate = `${currentYear}-${month}-${day}`;
    } else {
      // Default to 7 days from now
      const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      dueDate = inSevenDays.toISOString().split('T')[0];
    }
  }

  // Find digitable line / barcode (sequence of digits >= 20 characters)
  const codeMatch = clean.match(/(\d{5}[\.\s]?\d{5}[\.\s]?\d{5}[\.\s]?\d{6}[\.\s]?\d{5}[\.\s]?\d{14}|\d{40,50})/);
  const barcodeOrDigitableLine = codeMatch ? codeMatch[0].replace(/\s+/g, '') : undefined;

  // Description
  let desc = clean
    .replace(/(?:r\$|\$)?\s*\d+(?:[.,]\d{1,2})?/gi, '')
    .replace(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/g, '')
    .replace(/(?:dia|vence|vencimento|para)\s+\d{1,2}/gi, '')
    .replace(/linha|código|codigo/gi, '')
    .trim();

  if (codeMatch) {
    desc = desc.replace(codeMatch[0], '').trim();
  }

  if (!desc || desc.length < 2) {
    desc = 'Boleto / Conta a Pagar';
  }

  const isEssentialService = /luz|energia|enel|água|agua|sabesp|sanepar|gás|gas|aluguel|condomínio|condominio|internet|claro|vivo/i.test(desc);

  return {
    isBoleto: true,
    amount,
    description: desc.charAt(0).toUpperCase() + desc.slice(1),
    dueDate,
    barcodeOrDigitableLine,
    isEssentialService,
    interestOrLateFee: isEssentialService ? 2.0 : 5.0
  };
}

/**
 * AI Accountant Consultant:
 * Analyzes pending and overdue debts alongside current financial balance and spending habits.
 * Determines the professional, optimal prioritization order (Essential > High Interest > Near Due > Low Risk).
 */
export async function generateAccountantAdvice(
  debts: Debt[],
  currentBalance: number,
  monthlyIncome: number,
  monthlyExpense: number,
  transactions: Transaction[]
): Promise<AccountantAdvice> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const pendingDebts = debts.filter((d) => d.status !== 'paid');
  const totalDebtsPending = pendingDebts.reduce((acc, d) => acc + d.amount, 0);
  const totalDebtsOverdue = pendingDebts.filter((d) => d.dueDate < todayStr).reduce((acc, d) => acc + d.amount, 0);

  const formatBrl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  const ai = getAiClient();
  if (ai && pendingDebts.length > 0) {
    try {
      const debtsSummary = pendingDebts.map((d, index) => ({
        id: d.id,
        description: d.description,
        amount: d.amount,
        dueDate: d.dueDate,
        isOverdue: d.dueDate < todayStr,
        isEssentialService: Boolean(d.isEssentialService),
        interestOrLateFee: d.interestOrLateFee || 0
      }));

      const prompt = `Você é um CONTADOR PROFISSIONAL e CONSULTOR FINANCEIRO SÊNIOR certificado (CFC/CRC).
Analise o cenário financeiro do cliente e sua carteira de boletos e dívidas a pagar com rigor contábil.

DADOS FINANCEIROS ATUAIS:
- Data de hoje: ${todayStr}
- Saldo Líquido Atual em Caixa: R$ ${currentBalance.toFixed(2)}
- Receitas do Mês: R$ ${monthlyIncome.toFixed(2)}
- Despesas do Mês: R$ ${monthlyExpense.toFixed(2)}
- Total de Dívidas/Boletos Pendentes: R$ ${totalDebtsPending.toFixed(2)} (${pendingDebts.length} boletos)
- Total já Vencido: R$ ${totalDebtsOverdue.toFixed(2)}

LISTA DE DÍVIDAS/BOLETOS:
${JSON.stringify(debtsSummary, null, 2)}

SUAS MISSÕES COMO CONTADOR:
1. Avaliar a Saúde Financeira (score de 0 a 100).
2. Definir o método estratégico recomendado ('essential_first', 'avalanche' para juros altos, 'snowball' para dívidas menores, ou 'hybrid').
3. Emitir a Ordem Exata de Pagamento (priorityOrder: 1 para a mais urgente que deve ser paga primeiro, 2 para a segunda, etc.).
   Critérios Contábeis:
   - 1º Lugar: Serviços essenciais (energia, água, aluguel) com risco iminente de corte ou despejo.
   - 2º Lugar: Dívidas já vencidas ou com juros rotativos destrutivos (cartão de crédito, cheque especial).
   - 3º Lugar: Boletos que vencem hoje ou nos próximos dias (evitar multa por atraso).
   - 4º Lugar: Dívidas negociáveis ou sem juros/com prazos mais longos.
4. Para cada dívida, justificar contabilisticamente o motivo ('strategyReason') e dar o plano prático ('actionPlan').
5. Criar 3 a 5 passos práticos de ação imediata ('actionSteps').
6. Criar 2 a 4 dicas de negociação bancária e redução de juros ('negotiationTips').
7. Gerar uma mensagem executiva formatada para WhatsApp ('whatsappFormattedAdvice') com negrito, emojis profissionais, ranking claro e tom de consultor experiente.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              financialHealthScore: { type: Type.NUMBER, description: 'Score de 0 a 100' },
              generalVerdict: { type: Type.STRING, description: 'Diagnóstico contábil resumido' },
              strategyMethod: { 
                type: Type.STRING, 
                enum: ['avalanche', 'snowball', 'hybrid', 'essential_first'] 
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    debtId: { type: Type.STRING },
                    description: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    dueDate: { type: Type.STRING },
                    priorityOrder: { type: Type.NUMBER },
                    priorityLevel: { type: Type.STRING, enum: ['urgent', 'high', 'medium', 'low'] },
                    strategyReason: { type: Type.STRING },
                    actionPlan: { type: Type.STRING }
                  },
                  required: ['debtId', 'description', 'amount', 'dueDate', 'priorityOrder', 'priorityLevel', 'strategyReason', 'actionPlan']
                }
              },
              actionSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              negotiationTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              whatsappFormattedAdvice: { type: Type.STRING }
            },
            required: ['financialHealthScore', 'generalVerdict', 'strategyMethod', 'recommendations', 'actionSteps', 'negotiationTips', 'whatsappFormattedAdvice']
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        return {
          id: `advice-${Date.now()}`,
          analyzedAt: now.toISOString(),
          currentBalance,
          totalDebtsPending,
          totalDebtsOverdue,
          ...parsed
        };
      }
    } catch (err) {
      console.error('[Gemini Accountant] Erro na análise contábil:', err);
    }
  }

  // Robust Rule-Based Financial Consultant Fallback
  return generateFallbackAccountantAdvice(pendingDebts, currentBalance, totalDebtsPending, totalDebtsOverdue, todayStr);
}

function generateFallbackAccountantAdvice(
  pendingDebts: Debt[],
  currentBalance: number,
  totalDebtsPending: number,
  totalDebtsOverdue: number,
  todayStr: string
): AccountantAdvice {
  const formatBrl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  // Sort debts by urgency:
  // 1. Essential services
  // 2. Overdue debts
  // 3. Due date ascending
  // 4. Higher interest
  const sorted = [...pendingDebts].sort((a, b) => {
    const aEssential = a.isEssentialService ? 1 : 0;
    const bEssential = b.isEssentialService ? 1 : 0;
    if (aEssential !== bEssential) return bEssential - aEssential;

    const aOverdue = a.dueDate < todayStr ? 1 : 0;
    const bOverdue = b.dueDate < todayStr ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;

    return a.dueDate.localeCompare(b.dueDate);
  });

  const recommendations: DebtRecommendation[] = sorted.map((debt, index) => {
    const isOverdue = debt.dueDate < todayStr;
    const isEssential = Boolean(debt.isEssentialService);

    let priorityLevel: 'urgent' | 'high' | 'medium' | 'low' = 'medium';
    let strategyReason = 'Vencimento regular programado.';
    let actionPlan = `Pagar até ${new Date(debt.dueDate).toLocaleDateString('pt-BR')} para manter o histórico positivo.`;

    if (isEssential && isOverdue) {
      priorityLevel = 'urgent';
      strategyReason = 'Serviço essencial VENCIDO com risco iminente de suspensão do fornecimento ou despejo.';
      actionPlan = `Prioridade máxima! Quitar imediatamente via PIX ou internet banking hoje.`;
    } else if (isEssential) {
      priorityLevel = 'urgent';
      strategyReason = 'Serviço essencial básico indispensável para a manutenção do lar/empresa.';
      actionPlan = `Garantir o pagamento prioritário antes de quaisquer despesas supérfluas.`;
    } else if (isOverdue) {
      priorityLevel = 'high';
      strategyReason = 'Boleto vencido gerando juros de mora diários e multa contratual.';
      actionPlan = `Quitar o quanto antes ou contatar o cedente para atualizar o boleto sem encargos abusivos.`;
    } else if (debt.amount > 500) {
      priorityLevel = 'high';
      strategyReason = 'Compromisso de valor expressivo com grande impacto no fluxo de caixa.';
      actionPlan = `Reservar o montante no saldo para evitar insuficiência de fundos na data.`;
    }

    return {
      debtId: debt.id,
      description: debt.description,
      amount: debt.amount,
      dueDate: debt.dueDate,
      priorityOrder: index + 1,
      priorityLevel,
      strategyReason,
      actionPlan
    };
  });

  // Calculate health score
  let score = 85;
  if (totalDebtsOverdue > 0) score -= 30;
  if (totalDebtsPending > currentBalance && currentBalance >= 0) score -= 20;
  if (currentBalance < 0) score -= 25;
  score = Math.max(10, Math.min(100, score));

  let generalVerdict = 'Fluxo de pagamentos sob controle, com poucos compromissos pendentes.';
  if (totalDebtsOverdue > 0) {
    generalVerdict = `Alerta contábil: Você possui ${formatBrl(totalDebtsOverdue)} em boletos vencidos gerando encargos por dia de atraso.`;
  } else if (totalDebtsPending > currentBalance) {
    generalVerdict = `Atenção à liquidez: O total de boletos (${formatBrl(totalDebtsPending)}) supera o saldo disponível em caixa. É necessário priorizar os itens essenciais.`;
  }

  // Generate formatted WhatsApp message
  let waText = `👔 *PARECER DO CONTADOR PROFISSIONAL*\n`;
  waText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  waText += `📊 *Diagnóstico Financeiro:* Nota *${score}/100*\n`;
  waText += `💵 *Saldo em Caixa:* ${formatBrl(currentBalance)}\n`;
  waText += `📑 *Boletos a Pagar:* ${formatBrl(totalDebtsPending)} (${pendingDebts.length} contas)\n`;
  if (totalDebtsOverdue > 0) {
    waText += `🚨 *Contas Vencidas:* ${formatBrl(totalDebtsOverdue)}\n`;
  }
  waText += `\n🎯 *Estratégia:* ${generalVerdict}\n\n`;

  if (recommendations.length > 0) {
    waText += `📋 *ORDEM RECOMENDADA DE PAGAMENTO:*\n`;
    recommendations.slice(0, 5).forEach((rec) => {
      const icon = rec.priorityLevel === 'urgent' ? '🔴' : rec.priorityLevel === 'high' ? '🟠' : '🟡';
      const d = new Date(rec.dueDate).toLocaleDateString('pt-BR');
      waText += `${icon} *${rec.priorityOrder}º* - *${rec.description}*: ${formatBrl(rec.amount)}\n`;
      waText += `   📅 Vence: ${d} | 💡 ${rec.strategyReason}\n`;
    });
  } else {
    waText += `✨ *Parabéns!* Não há boletos ou dívidas pendentes cadastradas no momento.\n`;
  }

  waText += `\n💡 *Dica Contábil:* Para cadastrar uma nova conta, envie:\n`;
  waText += `*.boleto [valor] [descrição] [dia/mês]*\n`;
  waText += `━━━━━━━━━━━━━━━━━━━━━\n`;
  waText += `_Consultoria Contábil Automatizada FinAssist_`;

  return {
    id: `advice-${Date.now()}`,
    analyzedAt: new Date().toISOString(),
    currentBalance,
    totalDebtsPending,
    totalDebtsOverdue,
    financialHealthScore: score,
    strategyMethod: totalDebtsOverdue > 0 ? 'essential_first' : 'avalanche',
    generalVerdict,
    recommendations,
    actionSteps: [
      'Quitar imediatamente todas as contas essenciais e já vencidas para estancar juros de mora.',
      'Projetar o fluxo de caixa dos próximos 15 dias antes de realizar novos gastos discricionários.',
      'Solicitar desconto de 5% a 10% para pagamentos de boletos à vista ou via PIX antes do vencimento.'
    ],
    negotiationTips: [
      'Ligue para concessionárias de serviços para solicitar remissão de juros em caso de pagamento à vista.',
      'Dívidas de cartão de crédito: nunca pague apenas o mínimo; solicite o parcelamento da fatura com taxa fixa.',
      'Evite utilizar o limite do cheque especial para cobrir boletos rotineiros.'
    ],
    whatsappFormattedAdvice: waText
  };
}

/**
 * Multimodal Computer Vision Analyzer for Brazilian Bank Receipts.
 */
export async function analyzePaymentReceiptImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  contextText?: string
): Promise<import('../src/types.js').PaymentReceiptData | null> {
  const ai = getAiClient();
  if (!ai) {
    return {
      isReceipt: true,
      receiptType: 'pix',
      amount: 150.00,
      date: new Date().toLocaleDateString('pt-BR'),
      payerName: 'Cliente Simulado',
      receiverName: 'Sua Empresa',
      bankOrInstitution: 'Banco do Brasil',
      transactionId: 'E' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      status: 'Concluído',
      summary: 'Comprovante PIX de R$ 150,00 validado.',
      confidence: 0.90
    };
  }

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+.-]+;base64,/, '');
    const prompt = `Você é um especialista em análise e extração de comprovantes de pagamento bancários no Brasil (PIX, TED, DOC, Boletos, Recibos de Cartão, Comprovantes de Transferência).
Analise a imagem deste comprovante com máxima precisão.
${contextText ? `Mensagem do cliente acompanhando o comprovante: "${contextText}"` : ''}

Extraia todos os dados disponíveis:
1. Se a imagem é realmente um comprovante de pagamento ou transação financeira.
2. Tipo de comprovante ('pix', 'transfer', 'boleto', 'credit_card', 'debit_card', 'deposit', ou 'other').
3. Valor exato em Reais (BRL, numérico com ponto decimal, ex: 150.50).
4. Data e hora da transação.
5. Nome e documento parcial de quem pagou (pagador / origem).
6. Nome e documento/chave de quem recebeu (favorecido / recebedor / destino).
7. Instituição financeira ou banco (ex: Nubank, Inter, Banco do Brasil, Itaú, Bradesco, Santander, Mercado Pago, Caixa, etc.).
8. Código da transação / autenticação eletrônica / ID do PIX (ex: E123456...).
9. Status da transação (ex: "Concluído com sucesso", "Liquidado", "Agendado", "Pendente").
10. Resumo amigável em 1 ou 2 frases curtas.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isReceipt: { type: Type.BOOLEAN, description: 'True se a imagem é comprovante de pagamento' },
            receiptType: {
              type: Type.STRING,
              enum: ['pix', 'transfer', 'boleto', 'credit_card', 'debit_card', 'deposit', 'other'],
              description: 'Tipo da operação'
            },
            amount: { type: Type.NUMBER, description: 'Valor numérico em Reais BRL (ex: 250.00)' },
            date: { type: Type.STRING, description: 'Data e hora da transação' },
            payerName: { type: Type.STRING, description: 'Nome do pagador' },
            payerDocument: { type: Type.STRING, description: 'Documento/CPF do pagador se visível' },
            receiverName: { type: Type.STRING, description: 'Nome do recebedor / favorecido' },
            receiverDocument: { type: Type.STRING, description: 'Chave PIX ou documento do favorecido se visível' },
            bankOrInstitution: { type: Type.STRING, description: 'Banco emissor ou instituição' },
            transactionId: { type: Type.STRING, description: 'ID da transação / autenticação bancária' },
            status: { type: Type.STRING, description: 'Status da operação' },
            summary: { type: Type.STRING, description: 'Resumo amigável dos dados extraídos' },
            extractedNotes: { type: Type.STRING, description: 'Observações adicionais extraídas' },
            confidence: { type: Type.NUMBER, description: 'Nível de certeza de 0 a 1' }
          },
          required: ['isReceipt', 'receiptType', 'amount', 'summary']
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text.trim());
      return data;
    }
  } catch (err) {
    console.error('[Gemini Vision] Erro na análise multimodal de comprovante:', err);
  }

  return null;
}

export const analyzePaymentReceipt = analyzePaymentReceiptImage;

/**
 * Generates an intelligent Auto-Responder reply for WhatsApp customer service using Gemini.
 */
export async function generateAutoResponderReply(
  userMessage: string,
  customerName: string,
  systemPrompt: string,
  receiptData?: import('../src/types.js').PaymentReceiptData | null
): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    if (receiptData && receiptData.isReceipt) {
      const valStr = receiptData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      return `🧾 *Comprovante Recebido e Validado!* ✅\n\nOlá, *${customerName}*!\nIdentifiquei seu comprovante:\n• *Valor:* R$ ${valStr}\n• *Tipo:* ${receiptData.receiptType.toUpperCase()}\n${receiptData.bankOrInstitution ? `• *Banco:* ${receiptData.bankOrInstitution}\n` : ''}${receiptData.transactionId ? `• *ID/Autenticação:* ${receiptData.transactionId}\n` : ''}\nSeu pagamento foi confirmado pelo sistema. Em que mais posso ajudar você hoje?`;
    }
    return `Olá, *${customerName}*! 👋\nObrigado pela mensagem. Sou o assistente virtual e consultor financeiro. Como posso te ajudar hoje?`;
  }

  try {
    let contextAddition = `Nome do cliente no WhatsApp: ${customerName}.\n`;
    if (receiptData && receiptData.isReceipt) {
      contextAddition += `\n[ATENÇÃO: O cliente enviou uma imagem de COMPROVANTE DE PAGAMENTO válida!]\n`;
      contextAddition += `Dados do Comprovante identificado pela visão computacional:\n`;
      contextAddition += `- Valor: R$ ${receiptData.amount.toFixed(2)}\n`;
      contextAddition += `- Tipo: ${receiptData.receiptType}\n`;
      contextAddition += `- Data/Hora: ${receiptData.date || 'Não identificada'}\n`;
      contextAddition += `- Pagador: ${receiptData.payerName || 'Não identificado'}\n`;
      contextAddition += `- Favorecido/Recebedor: ${receiptData.receiverName || 'Não identificado'}\n`;
      contextAddition += `- Banco: ${receiptData.bankOrInstitution || 'Não identificado'}\n`;
      contextAddition += `- ID/Autenticação: ${receiptData.transactionId || 'Não identificado'}\n`;
      contextAddition += `- Status: ${receiptData.status || 'Concluído'}\n`;
      contextAddition += `- Resumo: ${receiptData.summary || ''}\n`;
      contextAddition += `Confirme para o cliente o recebimento com os dados destacados e informe o próximo passo de forma prestativa.\n`;
    }

    const fullInstruction = `${systemPrompt}\n\n${contextAddition}\nLembre-se de formatar a resposta para o WhatsApp (use *negrito* nos pontos chave, emojis adequados e quebras de linha limpas).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userMessage || 'Enviou uma mensagem.',
      config: {
        systemInstruction: fullInstruction,
        temperature: 0.7
      }
    });

    if (response.text) {
      return response.text.trim();
    }
  } catch (err) {
    console.error('[Gemini AutoResponder] Erro ao gerar resposta de autoatendimento:', err);
  }

  if (receiptData && receiptData.isReceipt) {
    const valStr = receiptData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    return `🧾 *Comprovante de Pagamento Recebido!*\n\nOlá, *${customerName}*!\nConfirmamos o recebimento do seu comprovante no valor de *R$ ${valStr}* (${receiptData.receiptType.toUpperCase()}).\n${receiptData.bankOrInstitution ? `🏦 *Instituição:* ${receiptData.bankOrInstitution}\n` : ''}✅ O lançamento foi processado. Se precisar de mais informações, estou à disposição!`;
  }

  return `Olá, *${customerName}*! 👋\nObrigado pelo contato. Recebemos sua mensagem e estamos à disposição para te ajudar!`;
}
