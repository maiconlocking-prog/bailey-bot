const makeWASocket = require('@whiskeysockets/baileys').default
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs-extra')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Bailey Bot', 'Chrome', '131.0.0'],
    pairingCode: true,
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('Conexão fechada. Reconectando...')
      if (shouldReconnect) setTimeout(startBot, 5000)
    } else if (connection === 'open') {
      console.log('✅ Bailey Bot Conectado com Sucesso!')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // Pairing Code
  if (!sock.authState.creds.registered) {
    console.log('\n📱 === BAILEY PAIRING ===')
    console.log('Digite seu número (ex: 5511999999999):')
    
    const phoneNumber = await new Promise(resolve => {
      process.stdout.write('Número: ')
      process.stdin.once('data', data => resolve(data.toString().trim().replace(/\s+/g, '')))
    })

    if (!phoneNumber || phoneNumber.length < 8) {
      console.log('❌ Número inválido.')
      process.exit(1)
    }

    try {
      const code = await sock.requestPairingCode(phoneNumber)
      console.log('\n✅ CÓDIGO: ' + code)
      console.log('\nCole no WhatsApp (Dispositivos Vinculados → Vincular com Número)')
    } catch (e) {
      console.log('Erro ao gerar código:', e.message)
    }
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue
      const from = msg.key.remoteJid
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
      if (text.toLowerCase() === '!ping') {
        await sock.sendMessage(from, { text: '🏓 Pong!' })
      }
    }
  })

  console.log('🚀 Iniciando...')
}

startBot().catch(err => console.error('Erro fatal:', err))