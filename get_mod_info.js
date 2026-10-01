/**
 * Generador de bloques de Mods para distribution.json
 * 
 * Uso:
 *   node get_mod_info.js "https://github.com/.../mod.jar"
 *   o también:
 *   node get_mod_info.js "C:\ruta\a\tu\mod.jar" "https://url.jar"
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const https = require('https')
const http = require('http')

const input = process.argv[2]
const optionalUrl = process.argv[3]

if (!input) {
    console.log('\n❌ Uso incorrecto.')
    console.log('Simplemente pega el enlace de GitHub:')
    console.log('  node get_mod_info.js "https://github.com/Andzamc/domifly-distro/releases/download/v1.0.0/tu-mod.jar"\n')
    process.exit(1)
}

function fetchUrl(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http
        client.get(url, { timeout: 30000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (maxRedirects <= 0) return reject(new Error('Demasiadas redirecciones'))
                const nextUrl = new URL(res.headers.location, url).toString()
                return resolve(fetchUrl(nextUrl, maxRedirects - 1))
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`))
            }
            const chunks = []
            res.on('data', c => chunks.push(c))
            res.on('end', () => resolve(Buffer.concat(chunks)))
        }).on('error', reject)
    })
}

async function run() {
    let fileBuffer
    let fileName
    let downloadUrl

    if (input.startsWith('http://') || input.startsWith('https://')) {
        downloadUrl = input
        fileName = path.basename(new URL(input).pathname)
        console.log(`\n⏳ Descargando y analizando "${fileName}" desde internet...`)
        try {
            fileBuffer = await fetchUrl(downloadUrl)
        } catch (err) {
            console.log(`❌ Error al descargar desde la URL: ${err.message}`)
            process.exit(1)
        }
    } else {
        if (!fs.existsSync(input)) {
            console.log(`\n❌ El archivo no existe en tu PC: ${input}\n`)
            process.exit(1)
        }
        fileBuffer = fs.readFileSync(input)
        fileName = path.basename(input)
        downloadUrl = optionalUrl || 'URL_DIRECTA_DEL_ARCHIVO_AQUI'
    }

    const size = fileBuffer.length
    const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex')
    const id = fileName.replace(/\.jar$/i, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-')

    const modBlock = {
        id: id,
        name: fileName.replace(/\.jar$/i, ''),
        type: 'File',
        artifact: {
            size: size,
            MD5: md5,
            url: downloadUrl,
            path: `mods/${fileName}`
        }
    }

    console.log('\n✅ ¡Listo! Copia y pega este bloque dentro de "modules" en tu distribution.json:\n')
    console.log(JSON.stringify(modBlock, null, 4))
    console.log('\n')
}

run()
