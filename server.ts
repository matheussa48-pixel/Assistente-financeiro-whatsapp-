import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { baileysManager } from './server/baileysManager.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ==========================================
  // WHATSAPP & BAILEYS API (DUAL INSTANCE)
  // ==========================================

  // Get all WhatsApp instances statuses (Instance 1 & Instance 2)
  app.get('/api/whatsapp/instances', (_req, res) => {
    try {
      res.json(baileysManager.getAllStatuses());
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao obter instâncias' });
    }
  });

  // Get WhatsApp status (supports ?instance=1 or ?instance=2)
  app.get('/api/whatsapp/status', (req, res) => {
    try {
      const instId = (req.query.instance === '2' ? '2' : '1') as '1' | '2';
      const status = baileysManager.getStatus(instId);
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao obter status do WhatsApp' });
    }
  });

  // Start Baileys connection for an instance (or both)
  app.post('/api/whatsapp/connect', async (req, res) => {
    try {
      const instanceId = req.body?.instanceId as '1' | '2' | undefined;
      await baileysManager.connect(instanceId);
      res.json({ success: true, message: `Iniciando conexão Baileys (${instanceId ? `Instância ${instanceId}` : 'todas'})...` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao conectar Baileys' });
    }
  });

  // Disconnect Baileys session
  app.post('/api/whatsapp/disconnect', async (req, res) => {
    try {
      const instanceId = req.body?.instanceId as '1' | '2' | undefined;
      await baileysManager.disconnect(instanceId);
      res.json({ success: true, message: `Instância ${instanceId || 'todas'} desconectada com sucesso.` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao desconectar' });
    }
  });

  // Request pairing code with phone number
  app.post('/api/whatsapp/pair', async (req, res) => {
    try {
      const { phone, instanceId } = req.body;
      if (!phone) {
        return res.status(400).json({ error: 'Número de telefone é obrigatório' });
      }
      const instId = (instanceId === '2' ? '2' : '1') as '1' | '2';
      const result = await baileysManager.requestPairingCode(phone, instId);
      res.json({
        success: true,
        pairingCode: typeof result === 'string' ? result : result.pairingCode,
        rawCode: typeof result === 'object' ? result.rawCode : undefined,
        alternativePhone: typeof result === 'object' ? result.alternativePhone : undefined,
        note: typeof result === 'object' ? result.note : undefined,
        instanceId: instId
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao gerar código de pareamento' });
    }
  });

  // Simulate an incoming WhatsApp message with optional receipt photo
  app.post('/api/whatsapp/simulate', async (req, res) => {
    try {
      const { text, sender, name, instanceId, imageBase64, mimeType } = req.body;
      const instId = (instanceId === '2' ? '2' : '1') as '1' | '2';
      const result = await baileysManager.simulateIncomingMessage(
        sender || '5511999998888',
        text || '',
        name || 'Você (Simulador)',
        instId,
        imageBase64,
        mimeType
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao simular mensagem' });
    }
  });

  // Dedicated AI Payment Receipt Analysis Endpoint
  app.post('/api/whatsapp/analyze-receipt', async (req, res) => {
    try {
      const { imageBase64, mimeType, contextText, autoRegister } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Imagem em base64 é obrigatória' });
      }

      const { analyzePaymentReceipt } = await import('./server/gemini.js');
      const receiptData = await analyzePaymentReceipt(imageBase64, mimeType || 'image/jpeg', contextText);

      if (!receiptData) {
        return res.status(400).json({ error: 'Não foi possível analisar o comprovante' });
      }

      let createdTx;
      if (autoRegister && receiptData.isReceipt && receiptData.amount > 0) {
        createdTx = db.addTransaction({
          type: 'income',
          amount: receiptData.amount,
          description: `Comprovante ${receiptData.receiptType.toUpperCase()}: ${receiptData.payerName || 'Cliente'} -> ${receiptData.receiverName || 'Empresa'}`,
          category: 'Salário & Renda',
          paymentMethod: receiptData.receiptType === 'credit_card' ? 'credit_card' :
                         receiptData.receiptType === 'debit_card' ? 'debit_card' : 'pix',
          date: new Date().toISOString(),
          source: 'whatsapp',
          notes: `Autenticação/ID: ${receiptData.transactionId || 'N/A'}. Banco: ${receiptData.bankOrInstitution || 'N/A'}. ${receiptData.summary || ''}`
        });
      }

      res.json({ receiptData, transactionCreated: createdTx });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao analisar comprovante' });
    }
  });

  // Send outgoing WhatsApp message
  app.post('/api/whatsapp/send', async (req, res) => {
    try {
      const { to, text, instanceId } = req.body;
      if (!to || !text) {
        return res.status(400).json({ error: 'Destinatário e texto são obrigatórios' });
      }
      const instId = (instanceId === '2' ? '2' : '1') as '1' | '2';
      await baileysManager.sendMessage(to, text, instId);
      res.json({ success: true, message: 'Mensagem enviada com sucesso', instanceId: instId });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao enviar mensagem' });
    }
  });

  // Get message logs
  app.get('/api/whatsapp/logs', (_req, res) => {
    res.json(db.getLogs());
  });

  // Clear message logs
  app.delete('/api/whatsapp/logs', (_req, res) => {
    db.clearLogs();
    res.json({ success: true });
  });

  // ==========================================
  // FINANCE MANAGEMENT API
  // ==========================================

  // Monthly summary
  app.get('/api/finance/summary', (req, res) => {
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const report = db.generateMonthlyReport(month);
    res.json({
      monthYear: report.monthYear,
      monthName: report.monthName,
      totalIncome: report.totalIncome,
      totalExpense: report.totalExpense,
      netBalance: report.netBalance,
      savingsRate: report.savingsRate,
      totalTransactionsCount: report.totalTransactionsCount,
      categories: report.categories
    });
  });

  // List transactions
  app.get('/api/finance/transactions', (req, res) => {
    let list = db.getTransactions();
    const type = req.query.type;
    const category = req.query.category;
    const month = req.query.month;

    if (type === 'expense' || type === 'income') {
      list = list.filter(t => t.type === type);
    }
    if (typeof category === 'string' && category) {
      list = list.filter(t => t.category === category);
    }
    if (typeof month === 'string' && month) {
      list = list.filter(t => t.date.startsWith(month));
    }

    res.json(list);
  });

  // Add transaction manually
  app.post('/api/finance/transactions', (req, res) => {
    try {
      const { type, amount, description, category, paymentMethod, date, notes } = req.body;
      if (!type || !amount || !description) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes (tipo, valor, descrição)' });
      }

      const tx = db.addTransaction({
        type,
        amount: Number(amount),
        description,
        category: category || (type === 'income' ? 'Salário & Renda' : 'Outros'),
        paymentMethod: paymentMethod || 'other',
        date: date || new Date().toISOString(),
        source: 'manual',
        notes
      });

      res.status(201).json(tx);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao registrar transação' });
    }
  });

  // Delete transaction
  app.delete('/api/finance/transactions/:id', (req, res) => {
    const success = db.deleteTransaction(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Transação não encontrada' });
    }
  });

  // Get categories
  app.get('/api/finance/categories', (_req, res) => {
    res.json(db.getCategories());
  });

  // Update category budget
  app.put('/api/finance/categories/:id', (req, res) => {
    const updated = db.updateCategory(req.params.id, req.body);
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Categoria não encontrada' });
    }
  });

  // Get full monthly report
  app.get('/api/finance/report', (req, res) => {
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const report = db.generateMonthlyReport(month);
    res.json(report);
  });

  // Dispatch monthly report to WhatsApp
  app.post('/api/finance/dispatch-report', async (req, res) => {
    try {
      const targetPhone = req.body.phone;
      const settings = db.getSettings();
      const phone = targetPhone || settings.targetWhatsAppNumber;

      if (!phone) {
        return res.status(400).json({ error: 'Nenhum número de WhatsApp informado para envio.' });
      }

      const report = db.generateMonthlyReport();
      const fullText = `📊 *RELATÓRIO MENSAL - ${settings.botName.toUpperCase()}*\n\n${report.whatsappFormattedText}`;

      await baileysManager.sendMessage(phone, fullText);
      res.json({ success: true, message: `Relatório enviado com sucesso para ${phone}` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Falha ao despachar relatório para o WhatsApp' });
    }
  });

  // ==========================================
  // BOLETOS E DÍVIDAS A PAGAR (DEBTS)
  // ==========================================

  // List debts
  app.get('/api/debts', (req, res) => {
    const status = req.query.status as string | undefined;
    let list = db.getDebts();
    if (status) {
      list = list.filter(d => d.status === status);
    }
    res.json(list);
  });

  // Create debt / boleto
  app.post('/api/debts', (req, res) => {
    try {
      const { description, amount, dueDate, category, barcodeOrDigitableLine, beneficiary, isEssentialService, interestOrLateFee, notes } = req.body;
      if (!description || !amount || !dueDate) {
        return res.status(400).json({ error: 'Campos obrigatórios: descrição, valor e data de vencimento' });
      }

      const debt = db.addDebt({
        description,
        amount: Number(amount),
        dueDate,
        category: category || 'Dívidas & Boletos',
        barcodeOrDigitableLine,
        beneficiary,
        isEssentialService: Boolean(isEssentialService),
        interestOrLateFee: interestOrLateFee ? Number(interestOrLateFee) : undefined,
        notes,
        source: 'manual',
        status: 'pending'
      });

      res.status(201).json(debt);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao cadastrar boleto' });
    }
  });

  // Update debt
  app.put('/api/debts/:id', (req, res) => {
    const updated = db.updateDebt(req.params.id, req.body);
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Boleto/Dívida não encontrada' });
    }
  });

  // Delete debt
  app.delete('/api/debts/:id', (req, res) => {
    const ok = db.deleteDebt(req.params.id);
    if (ok) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Boleto/Dívida não encontrada' });
    }
  });

  // Mark debt as paid
  app.post('/api/debts/:id/pay', (req, res) => {
    const createTx = req.body.createTransaction !== false;
    const result = db.markDebtPaid(req.params.id, createTx);
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Boleto/Dívida não encontrada' });
    }
  });

  // ==========================================
  // CONTADOR PROFISSIONAL IA (ACCOUNTANT ADVICE)
  // ==========================================
  app.get('/api/accountant/advice', async (_req, res) => {
    try {
      const { generateAccountantAdvice } = await import('./server/gemini.js');
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

      res.json(advice);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao gerar parecer do contador' });
    }
  });

  // Dispatch accountant advice to WhatsApp
  app.post('/api/accountant/dispatch-whatsapp', async (req, res) => {
    try {
      const { generateAccountantAdvice } = await import('./server/gemini.js');
      const debts = db.getDebts();
      const report = db.generateMonthlyReport();
      const txs = db.getTransactions();
      const settings = db.getSettings();

      const phone = req.body.phone || settings.targetWhatsAppNumber;
      const instanceId = (req.body.instanceId === '2' ? '2' : '1') as '1' | '2';

      if (!phone) {
        return res.status(400).json({ error: 'Telefone para envio não informado' });
      }

      const advice = await generateAccountantAdvice(
        debts,
        report.netBalance,
        report.totalIncome,
        report.totalExpense,
        txs
      );

      await baileysManager.sendMessage(phone, advice.whatsappFormattedAdvice, instanceId);
      res.json({ success: true, message: `Parecer contábil enviado com sucesso para ${phone}` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Falha ao despachar parecer contábil' });
    }
  });

  // Clear all saved user data (transactions, debts, logs)
  app.post('/api/system/clear-data', (_req, res) => {
    db.clearAllData();
    res.json({ success: true, message: 'Todos os dados salvos foram apagados.' });
  });

  // Get settings
  app.get('/api/finance/settings', (_req, res) => {
    res.json(db.getSettings());
  });

  // Update settings
  app.put('/api/finance/settings', (req, res) => {
    const updated = db.updateSettings(req.body);
    res.json(updated);
  });

  // ==========================================
  // VITE MIDDLEWARE / STATIC ASSETS
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FinAssist WhatsApp rodando na porta ${PORT}`);
  });
}

startServer();
