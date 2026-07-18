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

  // === PAIRING CODE ===
  if (!sock.authState.creds.registered) {
    console.log('\n\x1b[36m%s\x1b[0m', '📱 === MODO PAREAMENTO BAILEY ===')
    console.log('\x1b[33m%s\x1b[0m', 'Digite seu número completo com código do país.')
    console.log('\x1b[32m%s\x1b[0m', 'Exemplo: 5511999999999 (Brasil) ou 15551234567 (EUA)')
    
    const phoneNumber = await new Promise(resolve => {
      process.stdout.write('\x1b[35mNúmero: \x1b[0m')
      process.stdin.once('data', data => resolve(data.toString().trim().replace(/\s+/g, '')))
    })

    if (!phoneNumber || phoneNumber.length < 8) {
      console.log('\x1b[31m%s\x1b[0m', '❌ Número inválido! Tente novamente.')
      process.exit(1)
    }

    console.log('\x1b[36m%s\x1b[0m', `🔄 Gerando código para ${phoneNumber}...`)

    const code = await sock.requestPairingCode(phoneNumber)
    
    console.log('\n\x1b[32m%s\x1b[0m', '✅ CÓDIGO DE PAREAMENTO GERADO!')
    console.log('\x1b[37m%s\x1b[0m', `   🔥 ${code} 🔥`)
    console.log('\x1b[33m%s\x1b[0m', '\nAbra o WhatsApp no celular:')
    console.log('   1. Configurações → Dispositivos Vinculados')
    console.log('   2. Vincular Dispositivo')
    console.log('   3. "Vincular com Número de Telefone"')
    console.log('   4. Cole o código acima')
    console.log('\x1b[36m%s\x1b[0m', '\nAguarde a conexão... Bailey tá cuidando do resto.')
  }

  sock.ev.process(async (events) => {
    if (events['connection.update']) {
      const update = events['connection.update']
      const { connection, lastDisconnect } = update
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
        console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect)
        if (shouldReconnect) {
          startBot()
        }
      } else if (connection === 'open') {
        console.log('✅ Bailey Bot Connected!')
      }
    }

    if (events['creds.update']) {
      await saveCreds()
    }

    if (events['messages.upsert']) {
      const upsert = events['messages.upsert']
      for (const msg of upsert.messages) {
        if (!msg.message) continue
        const from = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''

        console.log(`Message from ${from}: ${text}`)

        // Basic commands
        if (text.toLowerCase() === '!ping') {
          await sock.sendMessage(from, { text: '🏓 Pong! Bailey is alive!' })
        } else if (text.toLowerCase() === '!menu') {
          const menu = `🤖 *Bailey Bot Menu*

` +
            `!ping - Check if bot is alive
` +
            `!owner - Show owner info
` +
            `!sticker - Reply to image/video to make sticker
` +
            `Type commands to interact!`
          await sock.sendMessage(from, { text: menu })
        } else if (text.toLowerCase() === '!owner') {
          await sock.sendMessage(from, { text: '👑 Owner: Your Name @ Your Number' })
        }
      }
    }
  })

  console.log('🚀 Bailey Bot Starting...')
}

startBot().catch(err => console.error('Error:', err))