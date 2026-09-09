import { db } from './db.js';
import { 
  parseNaturalLanguageExpense, 
  analyzePaymentReceiptImage, 
  generateAutoResponderReply,
  parseBoletoIntent,
  generateAccountantAdvice 
} from './gemini.js';
import { Transaction, PaymentReceiptData, WhatsAppInstanceId, Debt } from '../src/types.js';

export interface BotProcessResult {
  replyText: string;
  commandDetected?: string;
  transactionCreated?: Transaction;
  debtCreated?: Debt;
  receiptData?: PaymentReceiptData;
}

export interface ProcessMessageOptions {
  text: string;
  sender: string;
  senderName?: string;
  instanceId?: WhatsAppInstanceId;
  imageBase64?: string;
  mimeType?: string;
  receiptData?: PaymentReceiptData;
}

export async function processIncomingMessage(
  optionsOrText: string | ProcessMessageOptions,
  maybeSender?: string,
  maybeSenderName?: string
): Promise<BotProcessResult> {
  const options: ProcessMessageOptions = typeof optionsOrText === 'string'
    ? {
        text: optionsOrText,
        sender: maybeSender || '5511999998888',
        senderName: maybeSenderName || 'Contato WhatsApp',
        instanceId: '1'
      }
    : optionsOrText;

  const text = (options.text || '').trim();
  const sender = options.sender;
  const senderName = options.senderName || 'Contato WhatsApp';
  const instanceId = options.instanceId || '1';
  const settings = db.getSettings();
  const prefix = settings.commandPrefix || '.';

  // 1. Process payment receipt image if provided
  let receiptData: PaymentReceiptData | null = options.receiptData || null;
  if (!receiptData && options.imageBase64 && settings.readPaymentReceipts) {
    try {
      receiptData = await analyzePaymentReceiptImage(
        options.imageBase64,
        options.mimeType || 'image/jpeg',
        text
      );
    } catch (err) {
      console.error('[BotEngine] Erro ao analisar comprovante:', err);
    }
  }

  // If receipt is detected
  if (receiptData && receiptData.isReceipt) {
    let createdTx: Transaction | undefined;
    let createdDebt: Debt | undefined;

    // If it's a boleto image to pay
    if (receiptData.receiptType === 'boleto' && receiptData.amount > 0 && /pagar|aberto|vencimento|fatura/i.test(text + (receiptData.summary || ''))) {
      const todayStr = new Date().toISOString().split('T')[0];
      createdDebt = db.addDebt({
        description: `Boleto: ${receiptData.bankOrInstitution || receiptData.receiverName || 'Boleto Bancário'}`,
        amount: receiptData.amount,
        dueDate: receiptData.date ? receiptData.date.split('T')[0] : todayStr,
        status: 'pending',
        category: 'Dívidas & Boletos',
        beneficiary: receiptData.receiverName || receiptData.bankOrInstitution,
        barcodeOrDigitableLine: receiptData.transactionId,
        source: 'receipt_scan'
      });
    } else if (settings.autoRegisterReceiptTransactions && receiptData.amount > 0) {
      const now = new Date();
      createdTx = db.addTransaction({
        type: 'income',
        amount: receiptData.amount,
        description: `Comprovante ${receiptData.receiptType.toUpperCase()}: ${receiptData.payerName || 'Cliente'} -> ${receiptData.receiverName || 'Empresa'}`,
        category: 'Salário & Renda',
        paymentMethod: receiptData.receiptType === 'credit_card' ? 'credit_card' :
                       receiptData.receiptType === 'debit_card' ? 'debit_card' : 'pix',
        date: now.toISOString(),
        source: 'whatsapp',
        whatsappSender: `${senderName} (${sender})`,
        notes: `Autenticação/ID: ${receiptData.transactionId || 'N/A'}. Banco: ${receiptData.bankOrInstitution || 'N/A'}. ${receiptData.summary || ''}`
      });
    }

    // Auto-responder with AI prompt for receipt
    const prompt = settings.autoResponderPrompt;
    const aiReply = await generateAutoResponderReply(text, senderName, prompt, receiptData);

    return {
      commandDetected: 'Comprovante Identificado',
      replyText: aiReply,
      transactionCreated: createdTx,
      debtCreated: createdDebt,
      receiptData
    };
  }

  // 2. Check if it's a prefixed command
  if (text.startsWith(prefix)) {
    const withoutPrefix = text.slice(prefix.length).trim();
    const parts = withoutPrefix.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'menu':
      case 'ajuda':
      case 'help':
      case 'comandos':
        return {
          commandDetected: '.menu',
          replyText: buildMenuText(settings.botName, prefix)
        };

      case 'boleto':
      case 'divida':
      case 'dívida':
      case 'conta':
        return handleBoletoCommand(args, sender, senderName, prefix, text);

      case 'boletos':
      case 'dividas':
      case 'dívidas':
      case 'contas':
      case 'apagar_lista':
        return {
          commandDetected: '.boletos',
          replyText: buildBoletosListText(prefix)
        };

      case 'pagar':
      case 'quitar':
      case 'baixar':
        return handlePayBoletoCommand(args, prefix);

      case 'contador':
      case 'consultoria':
      case 'analise':
      case 'análise':
      case 'orientacao':
        return handleAccountantCommand(prefix);

      case 'gasto':
      case 'despesa':
      case 'g':
      case 'd':
        return handleExpenseCommand(args, sender, senderName, prefix);

      case 'receita':
      case 'ganho':
      case 'r':
        return handleIncomeCommand(args, sender, senderName, prefix);

      case 'saldo':
      case 'resumo':
      case 'balanço':
      case 'balanco':
        return {
          commandDetected: '.saldo',
          replyText: buildBalanceSummaryText()
        };

      case 'extrato':
      case 'historico':
      case 'ultimos':
        return {
          commandDetected: '.extrato',
          replyText: buildStatementText(args)
        };

      case 'relatorio':
      case 'relatório':
      case 'fechamento':
        return {
          commandDetected: '.relatorio',
          replyText: buildReportText(args)
        };

      case 'meta':
      case 'metas':
      case 'orcamento':
      case 'orçamento':
        return {
          commandDetected: '.orcamento',
          replyText: buildBudgetText()
        };

      case 'categorias':
      case 'categoria':
        return {
          commandDetected: '.categorias',
          replyText: buildCategoriesText()
        };

      case 'apagar':
      case 'remover':
      case 'desfazer':
        return handleUndoCommand(args);

      default:
        return {
          commandDetected: `.${command}`,
          replyText: `❓ *Comando "${prefix}${command}" não reconhecido.*\n\nDigite *${prefix}menu* para visualizar a lista completa de comandos disponíveis.`
        };
    }
  }

  const lower = text.toLowerCase();

  // Natural language check: Questions asking for financial / accountant advice
  if (
    /qual dívida pagar|quais dívidas pagar|o que pagar primeiro|quais contas pagar|orientação do contador|analise de dividas|análise de dívidas|conselho de dívida|conselho do contador/i.test(lower)
  ) {
    return handleAccountantCommand(prefix);
  }

  // Natural language check: Registering a boleto naturally
  if (/cadastrar boleto|novo boleto|boleto de|conta de luz|conta de agua|conta de água|aluguel vence/i.test(lower) && /\d+/.test(lower)) {
    return handleBoletoCommand([], sender, senderName, prefix, text);
  }

  // Natural language expense/income parsing
  if (settings.enableAiParsing) {
    const categories = db.getCategories().map(c => c.name);
    const parsed = await parseNaturalLanguageExpense(text, categories);

    if (parsed && parsed.isFinancial && parsed.amount > 0) {
      const now = new Date();
      const newTx = db.addTransaction({
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description,
        category: parsed.category,
        paymentMethod: parsed.paymentMethod,
        date: now.toISOString(),
        source: 'whatsapp',
        whatsappSender: sender
      });

      const formattedVal = parsed.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const emojiType = parsed.type === 'expense' ? '💸' : '💰';
      const labelType = parsed.type === 'expense' ? 'Despesa' : 'Receita';

      let reply = `🤖 *Registro Automático por IA* ${emojiType}\n\n`;
      reply += `✅ Entendi e anotei seu lançamento:\n`;
      reply += `📝 *Tipo:* ${labelType}\n`;
      reply += `🏷️ *Categoria:* ${parsed.category}\n`;
      reply += `💵 *Valor:* R$ ${formattedVal}\n`;
      reply += `📌 *Descrição:* ${parsed.description}\n`;
      if (parsed.paymentMethod && parsed.paymentMethod !== 'other') {
        reply += `💳 *Método:* ${formatPaymentMethod(parsed.paymentMethod)}\n`;
      }
      reply += `\n💬 _Dica: Digite *${prefix}saldo*, *${prefix}boletos* ou *${prefix}contador*._`;

      return {
        commandDetected: 'IA Natural Language',
        replyText: reply,
        transactionCreated: newTx
      };
    }
  }

  // Conversational / Customer Service Auto-Responder
  const isInstanceEnabled = instanceId === '2' ? settings.autoResponderInstance2 : settings.autoResponderInstance1;
  if (settings.autoResponderEnabled && isInstanceEnabled && text) {
    try {
      const aiReply = await generateAutoResponderReply(text, senderName, settings.autoResponderPrompt);
      return {
        commandDetected: 'Autoatendimento IA',
        replyText: aiReply
      };
    } catch (err) {
      console.error('[BotEngine] Erro no autoatendimento:', err);
    }
  }

  // Default conversational greeting
  return {
    replyText: `👋 Olá, *${senderName}*!\n\nSou seu *${settings.botName}* e Contador Virtual.\n\n✨ *O que posso fazer por você:*\n• *${prefix}boleto 150.00 Luz 20/09* ➔ Cadastra boleto/dívida\n• *${prefix}boletos* ➔ Lista contas pendentes e vencimentos\n• *${prefix}contador* ➔ Análise e ordem de prioridade de pagamento\n• *${prefix}gasto 35 almoço* ➔ Registra despesa diária\n• *${prefix}saldo* ➔ Balanço financeiro do mês\n\nDigite *${prefix}menu* para ver todos os comandos!`
  };
}

/**
 * Handles .boleto command
 */
async function handleBoletoCommand(
  args: string[],
  _sender: string,
  _senderName: string,
  prefix: string,
  fullText: string
): Promise<BotProcessResult> {
  const parsed = await parseBoletoIntent(fullText);

  if (!parsed || parsed.amount <= 0) {
    return {
      commandDetected: '.boleto',
      replyText: `⚠️ *Como cadastrar um boleto ou dívida:*\n\n*${prefix}boleto <valor> <descrição> [vencimento]*\n\n📌 *Exemplos:*\n• *${prefix}boleto 150.00 Conta de Luz 20/09*\n• *${prefix}boleto 450.00 Condomínio 10/10*\n• *${prefix}boleto 89.90 Internet linha 23793...*\n• *${prefix}boleto 1200 Fatura Cartão Nubank dia 15*\n\n💡 _Dica: Digite *${prefix}boletos* para listar ou *${prefix}contador* para orientações de pagamento._`
    };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = parsed.dueDate < todayStr;
  const isEssential = parsed.isEssentialService;

  const newDebt = db.addDebt({
    description: parsed.description,
    amount: parsed.amount,
    dueDate: parsed.dueDate,
    status: isOverdue ? 'overdue' : 'pending',
    category: 'Dívidas & Boletos',
    beneficiary: parsed.beneficiary,
    barcodeOrDigitableLine: parsed.barcodeOrDigitableLine,
    isEssentialService: isEssential,
    interestOrLateFee: parsed.interestOrLateFee || (isEssential ? 2.0 : 5.0),
    source: 'whatsapp'
  });

  const formattedAmount = parsed.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const [y, m, d] = parsed.dueDate.split('-');
  const formattedDate = `${d}/${m}/${y}`;

  // Calculate days remaining or overdue
  const dueDateTime = new Date(`${parsed.dueDate}T12:00:00Z`).getTime();
  const todayTime = new Date(`${todayStr}T12:00:00Z`).getTime();
  const diffDays = Math.round((dueDateTime - todayTime) / (1000 * 60 * 60 * 24));

  let statusBadge = '';
  if (diffDays < 0) {
    statusBadge = `🚨 *VENCIDO há ${Math.abs(diffDays)} dia(s)!* Gerando juros de mora.`;
  } else if (diffDays === 0) {
    statusBadge = `⚠️ *VENCE HOJE!* Pague até o fim do expediente.`;
  } else if (diffDays === 1) {
    statusBadge = `⏰ *Vence amanhã!* (${diffDays} dia restante)`;
  } else {
    statusBadge = `⏳ *Vence em ${diffDays} dias.*`;
  }

  let reply = `📄 *Boleto / Dívida Cadastrada com Sucesso!* ✅\n\n`;
  reply += `📌 *Descrição:* ${newDebt.description}\n`;
  reply += `💵 *Valor:* R$ ${formattedAmount}\n`;
  reply += `📅 *Vencimento:* ${formattedDate}\n`;
  reply += `🏷️ *Situação:* ${statusBadge}\n`;
  if (isEssential) {
    reply += `🚨 *Atenção:* Serviço essencial! Risco de interrupção ou corte se atrasar.\n`;
  }
  if (newDebt.barcodeOrDigitableLine) {
    reply += `🔢 *Linha Digitável salva:* ${newDebt.barcodeOrDigitableLine}\n`;
  }
  reply += `\n💬 *Ações rápidas:*\n`;
  reply += `• Quando pagar, envie: *${prefix}pagar ${newDebt.description.split(' ')[0]}*\n`;
  reply += `• Para consultoria de prioridade, envie: *${prefix}contador*`;

  return {
    commandDetected: '.boleto',
    replyText: reply,
    debtCreated: newDebt
  };
}

/**
 * Lists boletos and debts
 */
function buildBoletosListText(prefix: string): string {
  const debts = db.getDebts();
  const pending = debts.filter((d) => d.status !== 'paid');

  if (pending.length === 0) {
    return `✨ *Nenhum boleto ou dívida pendente!*\n\nTodas as suas contas cadastradas estão quitadas.\n\nPara cadastrar uma nova conta, envie:\n*${prefix}boleto <valor> <descrição> [data]*\nEx: *${prefix}boleto 120.00 Luz 25/09*`;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const total = pending.reduce((sum, d) => sum + d.amount, 0);

  let text = `╭━━━ 📄 *BOLETOS E DÍVIDAS A PAGAR* ━━━╮\n`;
  text += `│ Total pendente: *R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}* (${pending.length} contas)\n`;
  text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  pending.forEach((d, idx) => {
    const isOverdue = d.dueDate < todayStr;
    const isEssential = d.isEssentialService;
    const icon = isOverdue ? '🚨' : isEssential ? '⚡' : '📄';
    const [year, month, day] = d.dueDate.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    const val = d.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    text += `${icon} *${idx + 1}. ${d.description}*\n`;
    text += `   💵 R$ ${val} | 📅 Vence: *${formattedDate}* ${isOverdue ? '(VENCIDO!)' : ''}\n`;
    if (d.barcodeOrDigitableLine) {
      text += `   🔢 Código: ${d.barcodeOrDigitableLine.slice(0, 20)}...\n`;
    }
    text += `   👉 Pagar: *${prefix}pagar ${d.description.split(' ')[0]}*\n\n`;
  });

  text += `👔 _Dica do Contador: Digite *${prefix}contador* para ver a ordem exata de qual pagar primeiro._`;
  return text;
}

/**
 * Marks boleto as paid
 */
function handlePayBoletoCommand(args: string[], prefix: string): BotProcessResult {
  if (args.length === 0) {
    return {
      commandDetected: '.pagar',
      replyText: `⚠️ *Informe o boleto que deseja pagar.*\n\nExemplo:\n• *${prefix}pagar Luz*\n• *${prefix}pagar Aluguel*\n\nDigite *${prefix}boletos* para listar as contas pendentes.`
    };
  }

  const search = args.join(' ').toLowerCase();
  const debts = db.getDebts().filter((d) => d.status !== 'paid');

  const match = debts.find((d) => 
    d.id.toLowerCase() === search || 
    d.description.toLowerCase().includes(search) ||
    (d.beneficiary && d.beneficiary.toLowerCase().includes(search))
  );

  if (!match) {
    return {
      commandDetected: '.pagar',
      replyText: `❌ *Nenhum boleto pendente encontrado com "${args.join(' ')}".*\n\nDigite *${prefix}boletos* para verificar a lista de contas em aberto.`
    };
  }

  const result = db.markDebtPaid(match.id, true);
  const formattedVal = match.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return {
    commandDetected: '.pagar',
    replyText: `🎉 *Boleto Baixado e Pago com Sucesso!* ✅\n\n📌 *Conta:* ${match.description}\n💵 *Valor:* R$ ${formattedVal}\n🏷️ *Lançamento:* Registrado automaticamente como despesa no seu balanço financeiro!\n\nDigite *${prefix}saldo* ou *${prefix}boletos* para ver a situação atualizada.`,
    debtCreated: result?.debt,
    transactionCreated: result?.transaction
  };
}

/**
 * Handles AI Accountant advice request (.contador / .analise)
 */
async function handleAccountantCommand(_prefix: string): Promise<BotProcessResult> {
  const debts = db.getDebts();
  const report = db.generateMonthlyReport();
  const txs = db.getTransactions();

  const advice = await generateAccountantAdvice(
    debts,
    report.netBalance,
    report.totalIncome,
    report.totalExpense,
    txs
  );

  return {
    commandDetected: '.contador',
    replyText: advice.whatsappFormattedAdvice
  };
}

function handleExpenseCommand(
  args: string[],
  sender: string,
  _senderName: string,
  prefix: string
): BotProcessResult {
  if (args.length === 0) {
    return {
      commandDetected: '.gasto',
      replyText: `⚠️ *Formato incorreto!*\n\nUse:\n*${prefix}gasto <valor> <descrição>*\n\nExemplos:\n• *${prefix}gasto 45.90 Almoço*\n• *${prefix}gasto 120.00 Farmácia (pix)*\n• *${prefix}gasto 80 Gasolina #transporte*`
    };
  }

  const rawAmount = args[0].replace('R$', '').replace('r$', '').replace(',', '.');
  const amount = parseFloat(rawAmount);

  if (isNaN(amount) || amount <= 0) {
    return {
      commandDetected: '.gasto',
      replyText: `❌ *Valor inválido: "${args[0]}"*\nPor favor informe um número válido. Exemplo: *${prefix}gasto 50.00 Almoço*`
    };
  }

  const descriptionParts = args.slice(1);
  let description = descriptionParts.join(' ').trim();
  if (!description) {
    description = 'Gasto diverso';
  }

  const categories = db.getCategories();
  let categoryName = 'Outros';

  const hashMatch = description.match(/#([a-zA-ZÀ-ÿ0-9_-]+)/);
  if (hashMatch) {
    const tag = hashMatch[1].toLowerCase();
    description = description.replace(hashMatch[0], '').trim();
    const found = categories.find(c => c.name.toLowerCase().includes(tag));
    if (found) categoryName = found.name;
  } else {
    const lower = description.toLowerCase();
    if (/(mercado|almoço|almoco|jantar|lanche|pizza|hambúrguer|ifood|padaria|comida|açougue|cafe|café)/.test(lower)) {
      categoryName = categories.find(c => c.name.toLowerCase().includes('alimentação'))?.name || 'Alimentação';
    } else if (/(uber|99|gasolina|posto|combustível|pedágio|estacionamento|ônibus|onibus|metrô)/.test(lower)) {
      categoryName = categories.find(c => c.name.toLowerCase().includes('transporte'))?.name || 'Transporte';
    } else if (/(aluguel|luz|água|agua|energia|condomínio|condominio|internet|gás|iptu)/.test(lower)) {
      categoryName = categories.find(c => c.name.toLowerCase().includes('moradia'))?.name || 'Moradia & Contas';
    } else if (/(cinema|festa|bar|cerveja|jogo|show|viagem|passeio|restaurante)/.test(lower)) {
      categoryName = categories.find(c => c.name.toLowerCase().includes('lazer'))?.name || 'Lazer & Restaurantes';
    } else if (/(farmácia|farmacia|remédio|remedio|médico|dentista|exame|hospital)/.test(lower)) {
      categoryName = categories.find(c => c.name.toLowerCase().includes('saúde'))?.name || 'Saúde & Bem-Estar';
    } else if (/(netflix|spotify|amazon|prime|youtube|apple|hbo)/.test(lower)) {
      categoryName = categories.find(c => c.name.toLowerCase().includes('assinaturas'))?.name || 'Assinaturas & Tech';
    } else if (/(curso|livro|faculdade|escola|mensalidade)/.test(lower)) {
      categoryName = categories.find(c => c.name.toLowerCase().includes('educação'))?.name || 'Educação & Cursos';
    }
  }

  let paymentMethod: Transaction['paymentMethod'] = 'other';
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('pix')) paymentMethod = 'pix';
  else if (lowerDesc.includes('crédito') || lowerDesc.includes('credito') || lowerDesc.includes('cartão')) paymentMethod = 'credit_card';
  else if (lowerDesc.includes('débito') || lowerDesc.includes('debito')) paymentMethod = 'debit_card';
  else if (lowerDesc.includes('dinheiro')) paymentMethod = 'cash';

  const newTx = db.addTransaction({
    type: 'expense',
    amount,
    description,
    category: categoryName,
    paymentMethod,
    date: new Date().toISOString(),
    source: 'whatsapp',
    whatsappSender: sender
  });

  const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const report = db.generateMonthlyReport();

  let reply = `💸 *Despesa Registrada!* ✅\n\n`;
  reply += `📝 *Descrição:* ${description}\n`;
  reply += `🏷️ *Categoria:* ${categoryName}\n`;
  reply += `💵 *Valor:* R$ ${formattedAmount}\n`;
  reply += `💳 *Pagamento:* ${formatPaymentMethod(paymentMethod)}\n`;
  reply += `📊 *Total Gasto no Mês:* R$ ${report.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
  reply += `💬 _Digite *${prefix}saldo* ou *${prefix}menu* para mais opções._`;

  return {
    commandDetected: '.gasto',
    replyText: reply,
    transactionCreated: newTx
  };
}

function handleIncomeCommand(
  args: string[],
  sender: string,
  _senderName: string,
  prefix: string
): BotProcessResult {
  if (args.length === 0) {
    return {
      commandDetected: '.receita',
      replyText: `⚠️ *Formato incorreto!*\n\nUse:\n*${prefix}receita <valor> <descrição>*\n\nExemplos:\n• *${prefix}receita 2500 Salário Mensal*\n• *${prefix}receita 350 Freela Projeto*\n• *${prefix}receita 100 Venda Olx (pix)*`
    };
  }

  const rawAmount = args[0].replace('R$', '').replace('r$', '').replace(',', '.');
  const amount = parseFloat(rawAmount);

  if (isNaN(amount) || amount <= 0) {
    return {
      commandDetected: '.receita',
      replyText: `❌ *Valor inválido: "${args[0]}"*\nPor favor informe um número válido. Exemplo: *${prefix}receita 1500 Salário*`
    };
  }

  const descriptionParts = args.slice(1);
  let description = descriptionParts.join(' ').trim();
  if (!description) {
    description = 'Entrada / Receita';
  }

  let paymentMethod: Transaction['paymentMethod'] = 'pix';
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('transferência') || lowerDesc.includes('ted') || lowerDesc.includes('doc')) paymentMethod = 'transfer';
  else if (lowerDesc.includes('dinheiro')) paymentMethod = 'cash';

  const newTx = db.addTransaction({
    type: 'income',
    amount,
    description,
    category: 'Salário & Renda',
    paymentMethod,
    date: new Date().toISOString(),
    source: 'whatsapp',
    whatsappSender: sender
  });

  const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const report = db.generateMonthlyReport();

  let reply = `💰 *Receita Registrada!* ✅\n\n`;
  reply += `📝 *Descrição:* ${description}\n`;
  reply += `💰 *Valor Recebido:* R$ ${formattedAmount}\n`;
  reply += `💵 *Novo Saldo do Mês:* R$ ${report.netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
  reply += `💬 _Digite *${prefix}saldo* para mais detalhes._`;

  return {
    commandDetected: '.receita',
    replyText: reply,
    transactionCreated: newTx
  };
}

function buildMenuText(botName: string, prefix: string): string {
  return `╭━━━ 📊 *${botName.toUpperCase()}* ━━━╮
│ Assistente Financeiro & Contador Virtual
│ Conectado via WhatsApp Baileys
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

📄 *BOLETOS E DÍVIDAS A PAGAR:*

📄 *${prefix}boleto <valor> <descrição> [vencimento]*
   Lança um boleto ou conta a pagar.
   _Ex: ${prefix}boleto 150 Luz 20/09_
   _Ex: ${prefix}boleto 450 Condomínio 10/10 linha 23793..._

📑 *${prefix}boletos* (ou *${prefix}dividas*)
   Lista todas as contas a pagar e prazos de vencimento.

✅ *${prefix}pagar <descrição ou id>*
   Marca um boleto como quitado e registra no financeiro.
   _Ex: ${prefix}pagar Luz_

👔 *${prefix}contador* (ou *${prefix}analise*)
   Consultoria Contábil com IA: analisa suas dívidas
   e indica a ORDEM EXATA de qual pagar primeiro!

────────────────────────────
💵 *CONTROLE FINANCEIRO DIÁRIO:*

💸 *${prefix}gasto <valor> <descrição>*
   Registra uma despesa do dia.
   _Ex: ${prefix}gasto 45.90 almoço_

💰 *${prefix}receita <valor> <descrição>*
   Registra uma entrada de dinheiro ou salário.
   _Ex: ${prefix}receita 2500 salário mensal_

📊 *${prefix}saldo*
   Exibe receitas, despesas e saldo líquido do mês.

📑 *${prefix}extrato* [qtd]
   Lista os últimos lançamentos (padrão: 5).

📈 *${prefix}relatorio*
   Gera o relatório mensal detalhado com categorias.

🎯 *${prefix}meta* ou *${prefix}orcamento*
   Status das metas de gastos por categoria.

↩️ *${prefix}apagar*
   Desfaz o último lançamento registrado.

────────────────────────────
🤖 *INTELIGÊNCIA ARTIFICIAL ATIVA:*
Envie fotos de comprovantes (PIX, TED, Boletos) para leitura automática, ou pergunte:
• _"Quais dívidas devo pagar primeiro?"_
• _"Gastei 50 no posto hoje no débito"_`;
}

function buildBalanceSummaryText(): string {
  const report = db.generateMonthlyReport();
  const balanceEmoji = report.netBalance >= 0 ? '🟢' : '🔴';
  const debts = db.getDebts().filter(d => d.status !== 'paid');
  const totalDebts = debts.reduce((sum, d) => sum + d.amount, 0);

  let text = `╭━━━ 📊 *RESUMO FINANCEIRO* ━━━╮\n`;
  text += `│ Mês: *${report.monthName}*\n`;
  text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  text += `💰 *Receitas:* R$ ${report.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  text += `🔻 *Despesas:* R$ ${report.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  text += `${balanceEmoji} *Saldo Líquido:* R$ ${report.netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  text += `📈 *Taxa de Poupança:* ${report.savingsRate}%\n\n`;

  if (debts.length > 0) {
    text += `📑 *Boletos a Pagar:* R$ ${totalDebts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${debts.length} contas)\n`;
    text += `💡 _Digite *.boletos* para listar ou *.contador* para priorizar._\n\n`;
  }

  text += `📋 Total de lançamentos: *${report.totalTransactionsCount}*\n`;
  return text;
}

function buildStatementText(args: string[]): string {
  const limit = args.length > 0 && parseInt(args[0], 10) > 0 ? parseInt(args[0], 10) : 5;
  const transactions = db.getTransactions().slice(0, Math.min(limit, 15));

  if (transactions.length === 0) {
    return `ℹ️ *Nenhum lançamento encontrado ainda.*\n\nComece registrando com *.gasto 35 almoço* ou *.receita 1000*.`;
  }

  let text = `╭━━━ 📑 *ÚLTIMOS LANÇAMENTOS* ━━━╮\n`;
  text += `│ Exibindo os últimos ${transactions.length} registros\n`;
  text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  transactions.forEach((tx, idx) => {
    const isExp = tx.type === 'expense';
    const icon = isExp ? '🔻' : '💰';
    const sign = isExp ? '-' : '+';
    const val = tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const dateStr = new Date(tx.date).toLocaleDateString('pt-BR');
    text += `${icon} *${idx + 1}. ${tx.description}*\n`;
    text += `   ${sign}R$ ${val} | ${tx.category} | ${dateStr}\n\n`;
  });

  return text;
}

function buildReportText(args: string[]): string {
  const targetMonth = args.length > 0 ? args[0] : undefined;
  const report = db.generateMonthlyReport(targetMonth);
  return report.whatsappFormattedText;
}

function buildBudgetText(): string {
  const report = db.generateMonthlyReport();

  let text = `╭━━━ 🎯 *METAS E ORÇAMENTOS* ━━━╮\n`;
  text += `│ Acompanhe seus limites de gastos\n`;
  text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  for (const c of report.categories) {
    if (c.budget === 0 && c.spent === 0) continue;
    const alert = c.status === 'exceeded' ? '🚨' : c.status === 'warning' ? '⚠️' : '✅';
    const bar = makeBar(c.percentage);
    text += `${alert} *${c.category}*\n`;
    text += `   Gasto: R$ ${c.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / Limite: R$ ${c.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${c.percentage}%)\n`;
    text += `   ${bar}\n\n`;
  }

  text += `💬 _Você pode ajustar seus limites pelo painel da plataforma web._`;
  return text;
}

function buildCategoriesText(): string {
  const cats = db.getCategories();
  let text = `╭━━━ 🏷️ *CATEGORIAS DE GASTOS* ━━━╮\n`;
  text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

  cats.forEach(c => {
    text += `• *${c.name}* (Orçamento mensal: R$ ${c.monthlyBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n`;
  });

  text += `\n💡 _Dica: Ao registrar um gasto, use tags para forçar uma categoria:_\n*.gasto 50 almoço #alimentação*`;
  return text;
}

function handleUndoCommand(_args: string[]): BotProcessResult {
  const txs = db.getTransactions();
  if (txs.length === 0) {
    return {
      commandDetected: '.apagar',
      replyText: `ℹ️ Não há lançamentos recentes para desfazer.`
    };
  }

  const lastTx = txs[0];
  db.deleteTransaction(lastTx.id);

  return {
    commandDetected: '.apagar',
    replyText: `🗑️ *Lançamento desfeito com sucesso!*\n\nRemovido: *${lastTx.description}* (R$ ${lastTx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) da categoria *${lastTx.category}*.`
  };
}

function formatPaymentMethod(m: string): string {
  const map: Record<string, string> = {
    pix: 'Pix',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    cash: 'Dinheiro',
    transfer: 'Transferência'
  };
  return map[m] || m;
}

function makeBar(pct: number): string {
  const total = 8;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const filled = Math.round((clamped / 100) * total);
  const empty = total - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}
