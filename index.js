const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')

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
      if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
        console.log('Reconectando em 5s...')
        setTimeout(startBot, 5000)
      }
    } else if (connection === 'open') {
      console.log('✅ Bailey Bot Conectado!')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // Pairing
  if (!sock.authState.creds.registered) {
    console.log('\n📱 Digite seu número (ex: 5511999999999): ')
    const phoneNumber = await new Promise(r => {
      process.stdout.write('Número: ')
      process.stdin.once('data', d => r(d.toString().trim().replace(/\s+/g, '')))
    })

    try {
      console.log('Gerando código...')
      const code = await sock.requestPairingCode(phoneNumber)
      console.log('\n✅ CÓDIGO DE PAREAMENTO: ' + code)
      console.log('Cole no WhatsApp imediatamente!')
    } catch (e) {
      console.log('Erro ao gerar código:', e.message)
      console.log('Tente novamente ou use QR code.')
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

  console.log('🚀 Iniciando Bailey...')
}

startBot().catch(err => console.error('Erro:', err))