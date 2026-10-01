/**
 * AuthlibInjector - DomiFly Minecraft (ARCHIVO NUEVO)
 *
 * authlib-injector es el agente de Java que hace que Minecraft valide la sesión
 * y cargue las skins desde Ely.by en lugar de Mojang. Es lo que evita tener que
 * escribir comandos o instalar mods de skins.
 *
 * Se descarga la primera vez que se juega (no se empaqueta dentro del .asar,
 * porque Java no puede leer archivos dentro de un asar) y se verifica su SHA-256.
 */
const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')
const { LoggerUtil } = require('helios-core')

const ConfigManager = require('./configmanager')

const logger = LoggerUtil.getLogger('AuthlibInjector')

const LATEST_URL = 'https://authlib-injector.yushi.moe/artifact/latest.json'
const ELY_API_ROOT = 'https://authserver.ely.by/api/authlib-injector'

function jarDir() {
    return path.join(ConfigManager.getLauncherDirectory(), 'authlib-injector')
}

function jarPath() {
    return path.join(jarDir(), 'authlib-injector.jar')
}

function get(url, redirects = 5) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 30000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume()
                if (redirects <= 0) return reject(new Error('Demasiadas redirecciones al descargar authlib-injector'))
                return resolve(get(new URL(res.headers.location, url).toString(), redirects - 1))
            }
            if (res.statusCode !== 200) {
                res.resume()
                return reject(new Error(`HTTP ${res.statusCode} al descargar ${url}`))
            }
            const chunks = []
            res.on('data', (c) => chunks.push(c))
            res.on('end', () => resolve(Buffer.concat(chunks)))
        }).on('timeout', function () {
            this.destroy(new Error('Tiempo de espera agotado'))
        }).on('error', reject)
    })
}

/**
 * Se asegura de que el .jar exista y devuelve su ruta absoluta.
 * Llámalo (con await) ANTES de construir el ProcessBuilder.
 */
exports.ensure = async function () {
    const target = jarPath()
    if (fs.existsSync(target) && fs.statSync(target).size > 0) {
        return target
    }

    logger.info('Descargando authlib-injector...')
    const meta = JSON.parse((await get(LATEST_URL)).toString('utf8'))
    if (!meta.download_url) throw new Error('Respuesta inesperada al consultar authlib-injector')

    const jar = await get(meta.download_url)

    const expected = meta.checksums && meta.checksums.sha256
    if (expected) {
        const actual = crypto.createHash('sha256').update(jar).digest('hex')
        if (actual.toLowerCase() !== String(expected).toLowerCase()) {
            throw new Error('El SHA-256 de authlib-injector no coincide; descarga cancelada.')
        }
    }

    fs.mkdirSync(jarDir(), { recursive: true })
    const tmp = target + '.tmp'
    fs.writeFileSync(tmp, jar)
    fs.renameSync(tmp, target)
    logger.info('authlib-injector listo en', target)
    return target
}

/** Argumento JVM que hay que agregar al lanzar el juego. */
exports.javaAgentArg = function () {
    return `-javaagent:${jarPath()}=${ELY_API_ROOT}`
}

exports.ELY_API_ROOT = ELY_API_ROOT
