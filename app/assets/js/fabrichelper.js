/**
 * FabricHelper - DomiFly Minecraft
 * 
 * Descarga y resuelve automáticamente las librerías requeridas por Fabric Loader
 * (ASM, SpongeMixin, etc.) declaradas en su version.json.
 */
const fs = require('fs')
const path = require('path')
const https = require('https')
const { LoggerUtil } = require('helios-core')

const logger = LoggerUtil.getLogger('FabricHelper')

function mavenToPath(mavenId) {
    const parts = mavenId.split(':')
    const group = parts[0].replace(/\./g, '/')
    const artifact = parts[1]
    const version = parts[2]
    const classifier = parts[3] ? `-${parts[3]}` : ''
    return `${group}/${artifact}/${version}/${artifact}-${version}${classifier}.jar`
}

function download(url, dest) {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        const file = fs.createWriteStream(dest)
        https.get(url, { timeout: 30000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close()
                fs.unlinkSync(dest)
                return resolve(download(res.headers.location, dest))
            }
            if (res.statusCode !== 200) {
                file.close()
                fs.unlinkSync(dest)
                return reject(new Error(`HTTP ${res.statusCode} al descargar ${url}`))
            }
            res.pipe(file)
            file.on('finish', () => file.close(resolve))
        }).on('error', (err) => {
            file.close()
            try { fs.unlinkSync(dest) } catch (_e) {}
            reject(err)
        })
    })
}

exports.ensureFabricLibraries = async function (commonDir, modManifest) {
    if (!modManifest || !Array.isArray(modManifest.libraries)) return

    const baseMaven = 'https://maven.fabricmc.net/'
    for (const lib of modManifest.libraries) {
        if (!lib.name) continue
        const rel = mavenToPath(lib.name)
        const dest = path.join(commonDir, 'libraries', rel)

        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
            continue
        }

        const url = (lib.url || baseMaven) + rel
        logger.info(`Descargando librería Fabric: ${lib.name} desde ${url}`)
        try {
            await download(url, dest)
        } catch (err) {
            logger.warn(`No se pudo descargar ${lib.name} desde ${url}:`, err.message)
        }
    }
}

exports.getFabricClasspath = function (commonDir, modManifest) {
    if (!modManifest || !Array.isArray(modManifest.libraries)) return []
    const paths = []
    for (const lib of modManifest.libraries) {
        if (!lib.name) continue
        const rel = mavenToPath(lib.name)
        const p = path.join(commonDir, 'libraries', rel)
        if (fs.existsSync(p)) {
            paths.push(p)
        }
    }
    return paths
}
