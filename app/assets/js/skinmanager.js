/**
 * SkinManager - DomiFly Minecraft
 *
 * Administrador de skins y avatares para cuentas de Ely.by (y Mojang legacy).
 * Consulta la API de texturas de Ely.by para obtener el skin del jugador
 * y genera las URLs correspondientes para:
 *  - body: Cuerpo 3D completo (ideal para #avatarContainer y settings)
 *  - avatar: Cabeza isométrica 3D (ideal para preview en pantalla de login)
 *  - head: Cabeza frontal 2D (ideal para selectores y listas compactas)
 */
const got = require('got')

const DEFAULT_STEVE = {
    hash: 'steve',
    body: 'https://mc-heads.net/body/steve/right',
    avatar: 'https://mc-heads.net/avatar/steve/64',
    head: 'https://mc-heads.net/head/steve/40'
}

// Caché en memoria para evitar peticiones repetidas
const cache = new Map()

/**
 * Obtiene el nombre de usuario limpio desde un string o un objeto de cuenta.
 * @param {string|object} accountOrUsername
 * @returns {string}
 */
function extractUsername(accountOrUsername) {
    if (!accountOrUsername) return ''
    if (typeof accountOrUsername === 'string') return accountOrUsername.trim()
    return (accountOrUsername.displayName || accountOrUsername.username || '').trim()
}

/**
 * Consulta la información de skin para un usuario de Ely.by.
 * @param {string|object} accountOrUsername
 * @returns {Promise<{body: string, avatar: string, head: string, hash: string}>}
 */
async function getSkinDetails(accountOrUsername) {
    const username = extractUsername(accountOrUsername)
    if (!username) return { ...DEFAULT_STEVE }

    const key = username.toLowerCase()
    if (cache.has(key)) {
        return cache.get(key)
    }

    try {
        const res = await got(`https://skinsystem.ely.by/textures/${encodeURIComponent(username)}`, {
            responseType: 'json',
            timeout: 7000,
            retry: 1
        })

        if (res.body && res.body.SKIN && res.body.SKIN.url) {
            const skinUrl = res.body.SKIN.url
            const match = skinUrl.match(/\/texture\/([a-f0-9]+)/i)
            if (match) {
                const hash = match[1]
                const details = {
                    hash,
                    body: `https://mc-heads.net/body/${hash}/right`,
                    avatar: `https://mc-heads.net/avatar/${hash}/64`,
                    head: `https://mc-heads.net/head/${hash}/40`
                }
                cache.set(key, details)
                return details
            } else {
                // Skin directo de Ely.by sin hash de Mojang
                const directPng = `https://skinsystem.ely.by/skins/${encodeURIComponent(username)}.png`
                const details = {
                    hash: 'ely_custom',
                    body: directPng,
                    avatar: directPng,
                    head: directPng
                }
                cache.set(key, details)
                return details
            }
        }
    } catch (err) {
        // En caso de 204 (sin skin en Ely.by) o sin conexión, se intenta fallback por nombre o Steve
    }

    // Fallback a Steve por defecto
    const fallback = { ...DEFAULT_STEVE }
    cache.set(key, fallback)
    return fallback
}

/**
 * Aplica el avatar o cuerpo de un jugador a un elemento DOM.
 * @param {string|object} accountOrUsername Cuenta o nombre de usuario.
 * @param {HTMLElement} element Elemento destino (div, img, button, etc.).
 * @param {'body'|'avatar'|'head'} [type='body'] Tipo de vista deseada.
 */
function applyAvatar(accountOrUsername, element, type = 'body') {
    if (!element) return

    const username = extractUsername(accountOrUsername)

    // Si ya está en caché, lo aplicamos inmediatamente
    const key = username ? username.toLowerCase() : ''
    if (key && cache.has(key)) {
        const cached = cache.get(key)
        setImage(element, cached[type] || cached.body)
        return
    }

    // Aplicar Steve temporalmente mientras carga
    setImage(element, DEFAULT_STEVE[type] || DEFAULT_STEVE.body)

    if (!username) return

    getSkinDetails(username).then((details) => {
        if (element) {
            setImage(element, details[type] || details.body)
        }
    }).catch(() => {})
}

/**
 * Asigna una URL de imagen a un elemento según su etiqueta (<img> o CSS background).
 * @param {HTMLElement} element
 * @param {string} url
 */
function setImage(element, url) {
    if (!element || !url) return
    if (element.tagName === 'IMG') {
        if (element.src !== url) {
            element.src = url
        }
    } else {
        const bgUrl = `url('${url}')`
        if (element.style.backgroundImage !== bgUrl) {
            element.style.backgroundImage = bgUrl
        }
    }
}

module.exports = {
    getSkinDetails,
    applyAvatar,
    DEFAULT_STEVE
}
