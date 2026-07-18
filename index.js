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

  if (!sock.authState.creds.registered) {
    console.log('\n📱 === BAILEY PAIRING MODE ===')
    console.log('Digite seu número completo (ex: 5511999999999)')
    
    const phoneNumber = await new Promise(resolve => {
      process.stdout.write('Número: ')
      process.stdin.once('data', data => resolve(data.toString().trim().replace(/\s+/g, '')))
    })

    if (!phoneNumber || phoneNumber.length < 8) {
      console.log('❌ Número inválido!')
      process.exit(1)
    }

    console.log(`Gerando código para ${phoneNumber}...`)
    const code = await sock.requestPairingCode(phoneNumber)
    
    console.log('\n✅ CÓDIGO GERADO:')
    console.log(`   🔥 ${code} 🔥`)
    console.log('\n1. Abra WhatsApp → Dispositivos Vinculados')
    console.log('2. Vincular Dispositivo → Vincular com Número de Telefone')
    console.log('3. Cole o código acima\n')
  }

  sock.ev.process(async (events) => {
    if (events['connection.update']) {
      const { connection, lastDisconnect } = events['connection.update']
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
        console.log('Conexão fechada. Reconectando...')
        if (shouldReconnect) startBot()
      } else if (connection === 'open') {
        console.log('✅ Bailey Bot Conectado com Sucesso!')
      }
    }

    if (events['creds.update']) await saveCreds()

    if (events['messages.upsert']) {
      const { messages } = events['messages.upsert']
      for (const msg of messages) {
        if (!msg.message) continue
        const from = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''

        if (text.toLowerCase() === '!ping') {
          await sock.sendMessage(from, { text: '🏓 Pong! Bailey tá online!' })
        }
      }
    }
  })

  console.log('🚀 Iniciando Bailey Bot...')
}

startBot().catch(err => console.error('Erro:', err))