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

  if (!sock.authState.creds.registered) {
    console.log('\n📱 Digite seu número completo (ex: 5511999999999):')
    const phoneNumber = await new Promise(r => {
      process.stdout.write('Número: ')
      process.stdin.once('data', d => r(d.toString().trim().replace(/\s+/g, '')))
    })

    const code = await sock.requestPairingCode(phoneNumber)
    console.log('\n✅ CÓDIGO:', code)
    console.log('Cole no WhatsApp (Dispositivos Vinculados → Vincular com Número)')
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
        console.log('Reconectando...')
        setTimeout(startBot, 5000)
      }
    } else if (connection === 'open') {
      console.log('✅ Bailey Bot Conectado!')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue
      const from = msg.key.remoteJid
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
      if (text.toLowerCase() === '!ping') {
        await sock.sendMessage(from, { text: '🏓 Pong! Bailey online!' })
      }
    }
  })

  console.log('🚀 Iniciando Bailey Bot...')
}

startBot().catch(err => console.error('Erro:', err))