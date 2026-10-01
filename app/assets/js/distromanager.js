const { DistributionAPI } = require('helios-core/common')

const ConfigManager = require('./configmanager')

// URL pública del distribution.json de DomiFly (GitHub Pages).
exports.REMOTE_DISTRO_URL = 'https://andzamc.github.io/domifly-distro/distribution.json'

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    exports.REMOTE_DISTRO_URL,
    false
)

exports.DistroAPI = api