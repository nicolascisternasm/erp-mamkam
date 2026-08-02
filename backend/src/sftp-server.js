const { Server } = require('ssh2')
const { timingSafeEqual } = require('crypto')
const fs = require('fs')

const SFTP_USER = process.env.SFTP_USER || 'mamkam'
const SFTP_PASS = process.env.SFTP_PASSWORD || 'MamkamSFTP2026!'
const SFTP_PORT = parseInt(process.env.SFTP_PORT || '22', 10)

function iniciarSFTPServer(onArchivoRecibido) {
  const hostKeyPath = process.env.SFTP_HOST_KEY_PATH || '/tmp/host.key'

  let hostKey
  try {
    hostKey = fs.readFileSync(hostKeyPath)
  } catch (e) {
    console.error('[SFTP] No se pudo leer la host key:', e.message)
    return null
  }

  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    console.log('[SFTP] Cliente conectado')

    client.on('authentication', (ctx) => {
      if (
        ctx.method === 'password' &&
        ctx.username === SFTP_USER &&
        timingSafeEqual(Buffer.from(ctx.password), Buffer.from(SFTP_PASS))
      ) {
        ctx.accept()
      } else {
        ctx.reject()
      }
    })

    client.on('ready', () => {
      client.on('session', (accept) => {
        const session = accept()
        session.on('sftp', (accept) => {
          const sftp = accept()
          let buffers = []

          sftp.on('OPEN', (reqid, filename) => {
            console.log('[SFTP] Abriendo archivo:', filename)
            buffers = []
            sftp.handle(reqid, Buffer.from(filename))
          })

          sftp.on('WRITE', (reqid, handle, offset, data) => {
            buffers.push(Buffer.from(data))
            sftp.status(reqid, 0) // SSH_FX_OK
          })

          sftp.on('CLOSE', (reqid, handle) => {
            const fileName = handle.toString()
            if (buffers.length > 0) {
              const csvText = Buffer.concat(buffers).toString('utf8')
              console.log(`[SFTP] Archivo recibido: ${fileName} (${csvText.length} bytes)`)
              if (onArchivoRecibido) {
                onArchivoRecibido(fileName, csvText).catch(err =>
                  console.error('[SFTP] Error procesando archivo:', err.message)
                )
              }
            }
            sftp.status(reqid, 0)
          })

          sftp.on('REALPATH', (reqid) => {
            sftp.name(reqid, [{
              filename: '/',
              longname: 'drwxr-xr-x 1 user group 0 Jan 1 00:00 /',
              attrs: {},
            }])
          })

          sftp.on('STAT', (reqid) => {
            sftp.attrs(reqid, {
              mode: 0o755, uid: 0, gid: 0, size: 0,
              atime: Math.floor(Date.now() / 1000),
              mtime: Math.floor(Date.now() / 1000),
            })
          })

          sftp.on('LSTAT', (reqid) => {
            sftp.attrs(reqid, {
              mode: 0o755, uid: 0, gid: 0, size: 0,
              atime: Math.floor(Date.now() / 1000),
              mtime: Math.floor(Date.now() / 1000),
            })
          })
        })
      })
    })

    client.on('end', () => console.log('[SFTP] Cliente desconectado'))
    client.on('error', (err) => console.error('[SFTP] Error de cliente:', err.message))
  })

  server.on('error', (err) => console.error('[SFTP] Error de servidor:', err.message))

  server.listen(SFTP_PORT, '0.0.0.0', () => {
    console.log(`[SFTP] Servidor escuchando en puerto ${SFTP_PORT}`)
  })

  return server
}

module.exports = { iniciarSFTPServer }
