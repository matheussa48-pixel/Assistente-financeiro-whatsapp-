import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import pino from 'pino';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  Browsers,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import { db } from './db.js';
import { processIncomingMessage, BotProcessResult } from './botEngine.js';
import { WhatsAppSessionInfo, WhatsAppConnectionStatus, WhatsAppInstanceId } from '../src/types.js';

const BASE_LEGACY_AUTH_DIR = path.join(process.cwd(), 'baileys_auth_info');
const AUTH_DIR_1 = path.join(process.cwd(), 'baileys_auth_info_1');
const AUTH_DIR_2 = path.join(process.cwd(), 'baileys_auth_info_2');

// Migrate legacy single auth dir to instance 1 if exists and instance 1 does not
try {
  if (fs.existsSync(BASE_LEGACY_AUTH_DIR) && !fs.existsSync(AUTH_DIR_1)) {
    fs.cpSync(BASE_LEGACY_AUTH_DIR, AUTH_DIR_1, { recursive: true });
  }
} catch (err) {
  console.warn('[Baileys] Aviso ao migrar credenciais legadas:', err);
}

export function sanitizeWhatsAppNumber(phoneNumber: string): {
  clean: string;
  alternative?: string;
  formattedDisplay: string;
  note?: string;
} {
  let clean = phoneNumber.replace(/\D/g, '');

  // Remove leading zeroes (e.g. 011 -> 11, 055 -> 55)
  clean = clean.replace(/^0+/, '');

  // If starts with 550, remove the 0 after 55 (e.g. 55011987654321 -> 5511987654321)
  if (clean.startsWith('550')) {
    clean = '55' + clean.slice(3);
  }

  // If DDD + number without DDI 55 (10 or 11 digits in Brazil)
  if ((clean.length === 10 || clean.length === 11) && !clean.startsWith('55')) {
    clean = `55${clean}`;
  }

  let alternative: string | undefined;
  let note: string | undefined;

  // Brazilian numbers handling (DDI 55 + 2 DDD + 8 or 9 digits)
  if (clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const rest = clean.slice(4);

    if (clean.length === 13 && rest.startsWith('9')) {
      // 13 digits (55 + DDD + 9 + 8 digits). In Brazil, some WhatsApp accounts are registered without the 9.
      alternative = `55${ddd}${rest.slice(1)}`;
      note = 'Número brasileiro com o 9º dígito. Caso o WhatsApp não aceite o código, tente gerar sem o 9º dígito (alternativa abaixo) ou use o QR Code.';
    } else if (clean.length === 12) {
      // 12 digits (55 + DDD + 8 digits). Alternative has the 9.
      alternative = `55${ddd}9${rest}`;
      note = 'Número brasileiro sem o 9º dígito. Caso o WhatsApp não aceite o código, tente gerar com o 9º dígito (alternativa abaixo).';
    }
  }

  const formattedDisplay = clean.startsWith('55')
    ? `+55 (${clean.slice(2, 4)}) ${clean.length === 13 ? `${clean.slice(4, 9)}-${clean.slice(9)}` : `${clean.slice(4, 8)}-${clean.slice(8)}`}`
    : `+${clean}`;

  return { clean, alternative, formattedDisplay, note };
}

export class BaileysInstance {
  public readonly instanceId: WhatsAppInstanceId;
  public readonly instanceName: string;
  private readonly authDir: string;
  private socket: WASocket | null = null;
  private status: WhatsAppConnectionStatus = 'disconnected';
  private qrCodeDataUrl: string | null = null;
  private pairingCode: string | null = null;
  private rawPairingCode: string | null = null;
  private alternativePhone: string | null = null;
  private pairingCodeNote: string | null = null;
  private isPairingActive: boolean = false;
  private pairingTimeoutTimer: any = null;
  private userPhone: string | null = null;
  private userName: string | null = null;
  private lastConnectedAt: string | null = null;
  private lastError: string | null = null;
  private isSocketReady: boolean = false;
  private connectPromise: Promise<void> | null = null;
  private pairingPromise: Promise<{
    pairingCode: string;
    rawCode: string;
    phone: string;
    alternativePhone?: string;
    note?: string;
  }> | null = null;
  private pendingPairingNumber: string | null = null;
  private pairingResolver: {
    resolve: (code: string) => void;
    reject: (err: Error) => void;
  } | null = null;
  private activeChats = new Set<string>();

  constructor(instanceId: WhatsAppInstanceId, instanceName: string, authDir: string) {
    this.instanceId = instanceId;
    this.instanceName = instanceName;
    this.authDir = authDir;
    this.ensureAuthDir();
  }

  private ensureAuthDir() {
    try {
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      } else {
        const credsPath = path.join(this.authDir, 'creds.json');
        if (fs.existsSync(credsPath)) {
          try {
            const content = fs.readFileSync(credsPath, 'utf8');
            JSON.parse(content);
          } catch {
            console.warn(`[Baileys ${this.instanceId}] creds.json corrompido, reiniciando diretório...`);
            fs.rmSync(this.authDir, { recursive: true, force: true });
            fs.mkdirSync(this.authDir, { recursive: true });
          }
        }
      }
    } catch (err) {
      console.error(`[Baileys ${this.instanceId}] Erro ao preparar diretório de autenticação:`, err);
    }
  }

  getStatus(): WhatsAppSessionInfo {
    return {
      instanceId: this.instanceId,
      instanceName: this.instanceName,
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      pairingCode: this.pairingCode,
      rawPairingCode: this.rawPairingCode,
      alternativePhone: this.alternativePhone,
      pairingCodeNote: this.pairingCodeNote,
      userPhone: this.userPhone,
      userName: this.userName,
      lastConnectedAt: this.lastConnectedAt,
      lastError: this.lastError,
      activeChatsCount: this.activeChats.size
    };
  }

  async connect(): Promise<void> {
    if (this.status === 'connected' && this.socket) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.connectPromise = this._doConnect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private setupSocketEvents(sock: WASocket, saveCreds: () => Promise<void>) {
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      if (this.socket !== sock) {
        return;
      }

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.isSocketReady = true;

        if (this.pendingPairingNumber && this.pairingResolver) {
          const phone = this.pendingPairingNumber;
          const resolver = this.pairingResolver;
          this.pendingPairingNumber = null;
          this.pairingResolver = null;

          try {
            console.log(`[Baileys ${this.instanceId}] Solicitando código de pareamento para ${phone}...`);
            const rawCode = await sock.requestPairingCode(phone);
            const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
            this.pairingCode = formattedCode;
            this.rawPairingCode = rawCode;
            this.isPairingActive = true;
            this.qrCodeDataUrl = null;
            this.status = 'qr_ready';
            console.log(`[Baileys ${this.instanceId}] Código de pareamento gerado com sucesso:`, formattedCode);

            // Keep pairing code active for 3 minutes before allowing auto-switch
            if (this.pairingTimeoutTimer) clearTimeout(this.pairingTimeoutTimer);
            this.pairingTimeoutTimer = setTimeout(() => {
              this.isPairingActive = false;
            }, 180000);

            resolver.resolve(formattedCode);
            return;
          } catch (err: any) {
            console.error(`[Baileys ${this.instanceId}] Falha ao solicitar código de pareamento:`, err);
            this.isPairingActive = false;
            resolver.reject(new Error(err?.message || 'Falha ao solicitar código de pareamento ao WhatsApp'));
            return;
          }
        }

        // If pairing code is currently active, do NOT wipe the pairing code with null on QR refresh!
        if (this.isPairingActive && this.pairingCode) {
          return;
        }

        try {
          this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 300,
            color: { dark: '#000000', light: '#ffffff' }
          });
          this.status = 'qr_ready';
          this.pairingCode = null;
          this.rawPairingCode = null;
          this.lastError = null;
        } catch (err) {
          console.error(`[Baileys ${this.instanceId}] Erro ao converter QR Code para DataURL:`, err);
        }
      }

      if (connection === 'close') {
        this.isSocketReady = false;
        this.qrCodeDataUrl = null;

        if (this.pairingResolver) {
          const resolver = this.pairingResolver;
          this.pendingPairingNumber = null;
          this.pairingResolver = null;
          this.isPairingActive = false;
          resolver.reject(new Error('Conexão fechada durante a solicitação do código. Tente novamente ou use o QR Code.'));
        }

        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[Baileys ${this.instanceId}] Conexão encerrada (status ${statusCode}). Reconectar: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          this.status = 'disconnected';
          this.socket = null;
          this.pairingCode = null;
          this.rawPairingCode = null;
          this.isPairingActive = false;
          this.userPhone = null;
          this.userName = null;
          this.clearAuthDir();
          this.lastError = 'Sessão encerrada no WhatsApp. Por favor, conecte novamente.';
        } else if (shouldReconnect) {
          this.status = 'connecting';
          this.lastError = null;
          const delay = statusCode === DisconnectReason.restartRequired ? 800 : 3000;
          setTimeout(() => {
            if (this.status !== 'connected' && this.socket === sock && !this.isPairingActive) {
              this.connect().catch((err) => {
                console.error(`[Baileys ${this.instanceId}] Erro ao reconectar automaticamente:`, err);
              });
            }
          }, delay);
        } else {
          this.status = 'disconnected';
          this.socket = null;
          this.lastError = `Conexão fechada (${statusCode || 'offline'}).`;
        }
      } else if (connection === 'open') {
        this.isSocketReady = true;
        this.isPairingActive = false;
        this.status = 'connected';
        this.qrCodeDataUrl = null;
        this.pairingCode = null;
        this.rawPairingCode = null;
        this.lastError = null;
        this.lastConnectedAt = new Date().toISOString();

        if (sock.user) {
          const rawId = sock.user.id || '';
          const phoneOnly = rawId.split(':')[0].replace(/\D/g, '');
          this.userPhone = phoneOnly ? `+${phoneOnly}` : null;
          this.userName = sock.user.name || `WhatsApp ${this.instanceId}`;
        }

        console.log(`✅ [Baileys ${this.instanceId}] Conectado com sucesso!`, this.userPhone);
      }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
      if (this.socket !== sock) {
        return;
      }
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (msg.key.remoteJid === 'status@broadcast') continue;

        // Extract text caption or body
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';

        let imageBase64: string | undefined;
        let mimeType: string | undefined;

        // Extract and download media image (payment receipts, photos)
        if (msg.message?.imageMessage) {
          try {
            const buffer = await downloadMediaMessage(
              msg,
              'buffer',
              {},
              {
                logger: pino({ level: 'silent' }),
                reuploadRequest: sock.updateMediaMessage
              }
            );
            if (buffer) {
              imageBase64 = buffer.toString('base64');
              mimeType = msg.message.imageMessage.mimetype || 'image/jpeg';
            }
          } catch (imgErr) {
            console.warn(`[Baileys ${this.instanceId}] Falha ao baixar imagem:`, imgErr);
          }
        }

        if (!text && !imageBase64) continue;

        const senderJid = msg.key.remoteJid || '';
        const senderName = msg.pushName || 'Contato WhatsApp';
        const isFromMe = msg.key.fromMe || false;

        if (senderJid) this.activeChats.add(senderJid);

        // If message is from me, only process if explicitly command (to allow testing from own phone)
        if (isFromMe && !text.startsWith('.')) continue;

        const fromClean = senderJid.replace('@s.whatsapp.net', '');

        try {
          // Process message through bot and vision auto-responder engine
          const result = await processIncomingMessage({
            text: text || '',
            sender: fromClean,
            senderName,
            instanceId: this.instanceId,
            imageBase64,
            mimeType
          });

          // Log incoming message
          db.addLog({
            timestamp: new Date().toISOString(),
            direction: 'incoming',
            from: fromClean,
            to: this.instanceName,
            text: text || (imageBase64 ? '[📷 Foto/Comprovante de Pagamento]' : ''),
            senderName,
            instanceId: this.instanceId,
            hasImage: Boolean(imageBase64),
            receiptData: result.receiptData
          });

          // Send reply via Baileys socket
          await sock.sendMessage(senderJid, { text: result.replyText });

          // Log outgoing reply
          db.addLog({
            timestamp: new Date().toISOString(),
            direction: 'outgoing',
            from: this.instanceName,
            to: fromClean,
            text: result.replyText,
            commandDetected: result.commandDetected,
            transactionCreated: result.transactionCreated,
            instanceId: this.instanceId,
            receiptData: result.receiptData
          });
        } catch (err) {
          console.error(`[Baileys ${this.instanceId}] Erro ao processar mensagem do WhatsApp:`, err);
        }
      }
    });
  }

  private async _doConnect(): Promise<void> {
    this.status = 'connecting';
    this.lastError = null;

    try {
      this.ensureAuthDir();
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const logger = pino({ level: 'silent' });

      const sock = makeWASocket({
        logger,
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        markOnlineOnConnect: false
      });

      this.socket = sock;
      this.setupSocketEvents(sock, saveCreds);
    } catch (err: any) {
      this.isSocketReady = false;
      this.status = 'disconnected';
      this.lastError = err?.message || 'Erro ao iniciar Baileys';
      console.error(`[Baileys ${this.instanceId}] Falha ao inicializar:`, err);
    }
  }

  private async obtainPairingCodeWithFreshSocket(cleanPhone: string): Promise<string> {
    if (this.socket) {
      try {
        this.socket.end?.(new Error('Reset for pairing'));
      } catch {}
      this.socket = null;
    }
    this.isSocketReady = false;
    this.isPairingActive = true;
    this.status = 'connecting';

    // Clear previous auth credentials so we start with completely clean companion keys
    this.clearAuthDir();
    this.ensureAuthDir();
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      logger,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: false
    });

    this.socket = sock;

    const pairingPromise = new Promise<string>((resolve, reject) => {
      this.pendingPairingNumber = cleanPhone;
      this.pairingResolver = { resolve, reject };

      setTimeout(() => {
        if (this.pairingResolver) {
          this.pendingPairingNumber = null;
          this.pairingResolver = null;
          this.isPairingActive = false;
          reject(new Error('Tempo limite aguardando resposta dos servidores do WhatsApp (25s). Tente novamente ou use o QR Code.'));
        }
      }, 25000);
    });

    this.setupSocketEvents(sock, saveCreds);

    return await pairingPromise;
  }

  async requestPairingCode(phoneNumber: string): Promise<{
    pairingCode: string;
    rawCode: string;
    phone: string;
    alternativePhone?: string;
    note?: string;
  }> {
    const sanitized = sanitizeWhatsAppNumber(phoneNumber);
    const cleanPhone = sanitized.clean;

    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('Número de telefone inválido. Digite código do país e DDD (ex: 5511999998888 ou 11999998888)');
    }

    this.alternativePhone = sanitized.alternative || null;
    this.pairingCodeNote = sanitized.note || null;

    if (this.status === 'connected' && this.userPhone) {
      return {
        pairingCode: `Conectado: ${this.userPhone}`,
        rawCode: this.userPhone.replace(/\D/g, ''),
        phone: cleanPhone
      };
    }

    if (this.pairingPromise) {
      return this.pairingPromise;
    }

    this.pairingPromise = (async () => {
      // Always obtain with a fresh socket to guarantee clean companion keys and no QR collision
      const formattedCode = await this.obtainPairingCodeWithFreshSocket(cleanPhone);
      const raw = formattedCode.replace(/-/g, '');
      return {
        pairingCode: formattedCode,
        rawCode: raw,
        phone: cleanPhone,
        alternativePhone: sanitized.alternative,
        note: sanitized.note
      };
    })().finally(() => {
      this.pairingPromise = null;
    });

    return this.pairingPromise;
  }

  async reset(): Promise<void> {
    if (this.pairingTimeoutTimer) {
      clearTimeout(this.pairingTimeoutTimer);
      this.pairingTimeoutTimer = null;
    }
    this.isPairingActive = false;
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch {}
      try {
        this.socket.end(new Error('Reset solicitado pelo usuário'));
      } catch {}
      this.socket = null;
    }
    this.isSocketReady = false;
    this.status = 'disconnected';
    this.qrCodeDataUrl = null;
    this.pairingCode = null;
    this.rawPairingCode = null;
    this.alternativePhone = null;
    this.pairingCodeNote = null;
    this.userPhone = null;
    this.userName = null;
    this.lastError = null;
    this.clearAuthDir();
    this.ensureAuthDir();
  }

  async disconnect(): Promise<void> {
    await this.reset();
  }

  private clearAuthDir() {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }
      fs.mkdirSync(this.authDir, { recursive: true });
    } catch (err) {
      console.warn(`[Baileys ${this.instanceId}] Erro ao limpar diretório de autenticação:`, err);
    }
  }

  async sendMessage(toJidOrPhone: string, text: string): Promise<boolean> {
    let jid = toJidOrPhone;
    if (!jid.includes('@')) {
      const clean = jid.replace(/\D/g, '');
      jid = `${clean}@s.whatsapp.net`;
    }

    if (this.socket && this.status === 'connected') {
      try {
        await this.socket.sendMessage(jid, { text });
        db.addLog({
          timestamp: new Date().toISOString(),
          direction: 'outgoing',
          from: this.instanceName,
          to: jid.replace('@s.whatsapp.net', ''),
          text,
          commandDetected: 'Envio Manual/Agendado',
          instanceId: this.instanceId
        });
        return true;
      } catch (err) {
        console.error(`[Baileys ${this.instanceId}] Erro ao enviar mensagem:`, err);
        throw err;
      }
    }

    // If offline, still log for simulator and demo continuity
    db.addLog({
      timestamp: new Date().toISOString(),
      direction: 'outgoing',
      from: `${this.instanceName} (Simulado)`,
      to: jid.replace('@s.whatsapp.net', ''),
      text,
      commandDetected: 'Envio Direto',
      instanceId: this.instanceId
    });
    return true;
  }
}

class BaileysMultiManager {
  private instances: Map<WhatsAppInstanceId, BaileysInstance> = new Map();

  constructor() {
    this.instances.set('1', new BaileysInstance('1', 'WhatsApp 1 (Principal)', AUTH_DIR_1));
    this.instances.set('2', new BaileysInstance('2', 'WhatsApp 2 (Atendimento)', AUTH_DIR_2));
    this.initReportScheduler();
  }

  getInstance(id: WhatsAppInstanceId = '1'): BaileysInstance {
    const inst = this.instances.get(id);
    if (!inst) {
      return this.instances.get('1')!;
    }
    return inst;
  }

  getAllStatuses(): WhatsAppSessionInfo[] {
    return [
      this.getInstance('1').getStatus(),
      this.getInstance('2').getStatus()
    ];
  }

  getStatus(id: WhatsAppInstanceId = '1'): WhatsAppSessionInfo {
    return this.getInstance(id).getStatus();
  }

  async connect(id?: WhatsAppInstanceId): Promise<void> {
    if (id) {
      await this.getInstance(id).connect();
    } else {
      await Promise.all([
        this.getInstance('1').connect(),
        this.getInstance('2').connect()
      ]);
    }
  }

  async disconnect(id?: WhatsAppInstanceId): Promise<void> {
    if (id) {
      await this.getInstance(id).disconnect();
    } else {
      await Promise.all([
        this.getInstance('1').disconnect(),
        this.getInstance('2').disconnect()
      ]);
    }
  }

  async requestPairingCode(phone: string, id: WhatsAppInstanceId = '1'): Promise<string> {
    return this.getInstance(id).requestPairingCode(phone);
  }

  async sendMessage(to: string, text: string, id: WhatsAppInstanceId = '1'): Promise<boolean> {
    return this.getInstance(id).sendMessage(to, text);
  }

  async simulateIncomingMessage(
    senderPhone: string,
    messageText: string,
    senderName: string = 'Você (Simulador)',
    instanceId: WhatsAppInstanceId = '1',
    imageBase64?: string,
    mimeType?: string
  ): Promise<BotProcessResult> {
    const fromClean = senderPhone.replace(/\D/g, '') || '5511999998888';
    const instance = this.getInstance(instanceId);

    // Process through engine
    const result = await processIncomingMessage({
      text: messageText,
      sender: fromClean,
      senderName,
      instanceId,
      imageBase64,
      mimeType
    });

    // Log incoming
    db.addLog({
      timestamp: new Date().toISOString(),
      direction: 'incoming',
      from: fromClean,
      to: instance.instanceName,
      text: messageText || (imageBase64 ? '[📷 Foto/Comprovante de Pagamento]' : ''),
      senderName,
      instanceId,
      hasImage: Boolean(imageBase64),
      receiptData: result.receiptData
    });

    // Log outgoing simulated reply
    db.addLog({
      timestamp: new Date().toISOString(),
      direction: 'outgoing',
      from: instance.instanceName,
      to: fromClean,
      text: result.replyText,
      commandDetected: result.commandDetected,
      transactionCreated: result.transactionCreated,
      instanceId,
      receiptData: result.receiptData
    });

    return result;
  }

  private initReportScheduler() {
    setInterval(() => {
      this.checkAndSendScheduledMonthlyReport();
    }, 60 * 60 * 1000);
  }

  async checkAndSendScheduledMonthlyReport(force: boolean = false): Promise<boolean> {
    const settings = db.getSettings();
    if (!settings.autoMonthlyReport && !force) return false;

    const today = new Date();
    const day = today.getDate();

    if (force || day === settings.reportDayOfMonth) {
      const report = db.generateMonthlyReport();
      const inst1 = this.getInstance('1');
      const target = settings.targetWhatsAppNumber || (inst1.getStatus().userPhone ? inst1.getStatus().userPhone!.replace(/\D/g, '') : '');

      if (!target) return false;

      const reportText = `📢 *DISPARO AUTOMÁTICO DE FECHAMENTO MENSAL*\n\n${report.whatsappFormattedText}`;
      return inst1.sendMessage(target, reportText);
    }
    return false;
  }
}

export const baileysManager = new BaileysMultiManager();
