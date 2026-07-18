const makeWASocket = require('@whiskeysockets/baileys').default
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')
const qrcode = require('qrcode-terminal')
const fs = require('fs-extra')
const path = require('path')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['Bailey Bot', 'Chrome', '4.0.0'],
  })

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