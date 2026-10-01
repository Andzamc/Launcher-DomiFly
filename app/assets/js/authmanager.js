/**
 * AuthManager - DomiFly Minecraft
 *
 * Autenticación exclusivamente con cuentas de Ely.by (API tipo Yggdrasil).
 * Endpoints: https://authserver.ely.by/auth/{authenticate,refresh,validate,invalidate}
 *
 * Se usa el módulo nativo `https` de Node (y no fetch) a propósito: el renderer
 * de Electron corre desde file:// y fetch quedaría bloqueado por CORS.
 *
 * La contraseña NUNCA se guarda: solo accessToken y clientToken.
 */
const https = require('https')
const crypto = require('crypto')
const { LoggerUtil } = require('helios-core')

const ConfigManager = require('./configmanager')

const logger = LoggerUtil.getLogger('AuthManager')

const ELY_AUTH_BASE = 'https://authserver.ely.by/auth/'
const ACCOUNT_TYPE = 'ely'

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function elyRequest(endpoint, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body)
        const req = https.request(ELY_AUTH_BASE + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 15000
        }, (res) => {
            let raw = ''
            res.setEncoding('utf8')
            res.on('data', (chunk) => { raw += chunk })
            res.on('end', () => {
                let data = {}
                if (raw) {
                    try { data = JSON.parse(raw) } catch (e) { /* respuesta sin JSON */ }
                }
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    return resolve(data) // validate/invalidate responden 204 vacío
                }
                const err = new Error(data.errorMessage || `HTTP ${res.statusCode}`)
                err.status = res.statusCode
                err.elyError = data.error
                err.elyMessage = data.errorMessage || ''
                reject(err)
            })
        })
        req.on('timeout', () => req.destroy(new Error('Tiempo de espera agotado')))
        req.on('error', (e) => { e.network = true; reject(e) })
        req.write(payload)
        req.end()
    })
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

/** ¿Ely.by está pidiendo el código de verificación en dos pasos? */
exports.requiresTwoFactor = function (err) {
    return !!err && /two[\s-]?factor/i.test(err.elyMessage || err.message || '')
}

/** Convierte un error de la API en un mensaje entendible en español. */
exports.describeError = function (err) {
    if (!err) return 'Error desconocido.'
    if (err.network) return 'No se pudo conectar con Ely.by. Revisa tu conexión a internet.'
    if (exports.requiresTwoFactor(err)) return 'Esta cuenta usa verificación en dos pasos. Escribe el código de tu aplicación.'
    const msg = err.elyMessage || err.message || ''
    if (/invalid credentials|invalid nickname or password/i.test(msg)) return 'Usuario o contraseña incorrectos.'
    if (/temporarily banned|too many/i.test(msg) || err.status === 429) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
    if (/migrated|minecraft profile/i.test(msg)) return 'Esta cuenta de Ely.by no tiene un perfil de Minecraft.'
    return msg || 'No se pudo iniciar sesión.'
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Inicia sesión con Ely.by y deja la cuenta guardada y seleccionada.
 * @param {string} usernameOrEmail Nick o correo de Ely.by.
 * @param {string} password Contraseña.
 * @param {string} [totp] Código 2FA (solo si la cuenta lo tiene activo).
 * @returns {Promise<Object>} La cuenta guardada en ConfigManager.
 */
exports.addElyAccount = async function (usernameOrEmail, password, totp) {
    const clientToken = crypto.randomUUID().replace(/-/g, '')

    const data = await elyRequest('authenticate', {
        username: usernameOrEmail,
        // Con 2FA, Ely.by espera "contraseña:código" en el mismo campo.
        password: totp ? `${password}:${totp}` : password,
        clientToken,
        requestUser: true
    })

    const profile = data.selectedProfile
    if (!profile || !profile.id) {
        const err = new Error('Esta cuenta de Ely.by no tiene un perfil de Minecraft.')
        err.elyMessage = err.message
        throw err
    }

    // Compatibilidad con distintas versiones de Helios.
    const add = ConfigManager.addMojangAuthAccount || ConfigManager.addAuthAccount
    const ret = add.call(ConfigManager, profile.id, data.accessToken, profile.name, profile.name)

    ret.type = ACCOUNT_TYPE
    ret.clientToken = clientToken

    ConfigManager.setSelectedAccount(profile.id)
    ConfigManager.save()
    return ret
}

/**
 * Comprueba la cuenta seleccionada al iniciar el launcher.
 * - Token válido: true.
 * - Token vencido: lo refresca, true.
 * - Rechazado por Ely.by: false (hay que volver a iniciar sesión).
 * - Sin internet: true (no se echa al jugador; el juego mostrará el error de red).
 */
exports.validateSelected = async function () {
    const acc = ConfigManager.getSelectedAccount()
    if (!acc) return false
    if (acc.type !== ACCOUNT_TYPE) return false // cuentas antiguas (offline/Microsoft) ya no sirven

    try {
        await elyRequest('validate', { accessToken: acc.accessToken, clientToken: acc.clientToken })
        return true
    } catch (err) {
        if (err.network) {
            logger.warn('Sin conexión con Ely.by; se omite la validación de la sesión.')
            return true
        }
    }

    try {
        const data = await elyRequest('refresh', { accessToken: acc.accessToken, clientToken: acc.clientToken })
        acc.accessToken = data.accessToken
        ConfigManager.save()
        logger.info('Token de Ely.by refrescado.')
        return true
    } catch (err) {
        if (err.network) return true
        logger.warn('La sesión de Ely.by ya no es válida:', err.message)
        return false
    }
}

/** Cierra sesión: invalida el token en Ely.by y borra la cuenta local. */
exports.removeElyAccount = async function (uuid) {
    const acc = ConfigManager.getAuthAccount(uuid)
    if (acc) {
        try {
            await elyRequest('invalidate', { accessToken: acc.accessToken, clientToken: acc.clientToken })
        } catch (err) {
            logger.warn('No se pudo invalidar el token en Ely.by (se borra igual en local):', err.message)
        }
    }
    ConfigManager.removeAuthAccount(uuid)
    ConfigManager.save()
}

// Alias con los nombres originales de Helios, para que settings.js y otros
// archivos que aún los llamen sigan funcionando sin tocarlos.
exports.removeMojangAccount = exports.removeElyAccount
exports.removeMicrosoftAccount = exports.removeElyAccount