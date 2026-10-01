# Contexto Técnico del Proyecto

## Descripción General

- Launcher de escritorio para DomiFly Minecraft. Descarga, valida, configura y ejecuta una instancia modded del servidor sin exigir al usuario instalar manualmente Java, Fabric ni mods.
- Base: fork/adaptación de Helios Launcher (`helios-core` y `helios-distribution-types`). El producto declarado en `package.json` es `DomiFly Launcher` v2.2.1; `electron-builder.yml` aún conserva `Helios Launcher` como `productName`.
- Stack principal:
  - Electron 39 + Node.js 22, JavaScript CommonJS.
  - EJS/EJS-Electron para vistas, HTML/CSS y jQuery para interacción/animaciones.
  - `electron-builder` para instaladores Windows NSIS, macOS DMG y Linux AppImage.
  - `helios-core` para distribución, reparación/descarga, Java, Mojang y utilidades de lanzamiento.
  - `electron-updater`, `fs-extra`, `got`, `adm-zip`, `toml`, `lodash.merge`, `semver`, `discord-rpc-patch`.
  - Minecraft 1.21.x con Fabric Loader/Fabric API y Java >=21 en la distribución actual.
  - Mod Fabric local `CustomMinecraft`, Java 21, con mixins para personalizar ventana, pantallas, logo y watermark.

## Arquitectura y Estructura del Proyecto

```text
index.js                         Proceso principal Electron, ventana, IPC, OAuth heredado y updater
package.json                     Scripts y dependencias
electron-builder.yml             Empaquetado multiplataforma
distribution.json                Índice local de ejemplo/configuración DomiFly
app/
  app.ejs                        Shell de la interfaz; incluye frame, login, landing, settings y overlay
  *.ejs                          Vistas del launcher
  assets/css/launcher.css        Estilos globales
  assets/js/preloader.js         Inicialización antes de cargar la UI
  assets/js/configmanager.js     Persistencia, cuentas, rutas, RAM, Java y mods
  assets/js/distromanager.js     URL y cliente de distribución
  assets/js/authmanager.js       Autenticación Ely.by/Yggdrasil
  assets/js/authlibinjector.js   Descarga/verificación del agente de skins Ely.by
  assets/js/fabrichelper.js      Descarga de librerías declaradas por Fabric
  assets/js/processbuilder.js    Construcción y spawn del proceso Minecraft
  assets/js/scripts/             Controladores UI: login, landing, settings, binder, core
  assets/lang/                   Traducciones TOML y personalizaciones
  assets/images/                 Fondos, iconos y recursos de UI
assets/customminecraft/          Icono/recurso del mod Fabric personalizado
wtf/flonxi/                      Clases Java compiladas del mod CustomMinecraft
customminecraft.mixins.json      Configuración de mixins Fabric
fabric.mod.json                  Metadatos, entrypoints y dependencias del mod
libraries/java/                  Recursos Java distribuidos/empaquetados
build/                            Recursos de build
docs/                             Especificación de distribución y autenticación Microsoft
.github/workflows/build.yml       Build CI para Windows, macOS y Linux
```

### Flujo principal de ejecución

1. `index.js` inicializa Electron, desactiva aceleración por hardware, configura idioma y crea una `BrowserWindow` sin marco con `preloader.js`, integración Node y `contextIsolation: false`.
2. `preloader.js` carga `ConfigManager`, establece directorios comunes/instancias, carga idioma y obtiene la distribución mediante `DistroAPI`.
3. `distromanager.js` usa la URL remota `https://andzamc.github.io/domifly-distro/distribution.json`; la distribución se cachea y se selecciona el servidor principal si no hay selección válida.
4. `uibinder.js` muestra login o landing según las cuentas almacenadas; prepara settings, servidor, noticias y estado del servidor.
5. Login visible: `login.js` llama a `AuthManager.addElyAccount`; `authmanager.js` autentica contra `https://authserver.ely.by/auth/`, guarda token/client token y soporta 2FA.
6. Al pulsar jugar, `landing.js` valida Java; si falta una versión compatible, descarga y extrae el JDK recomendado. Luego `FullRepair` verifica y descarga assets, librerías, loader y mods según la distribución.
7. Se descarga/verifica `authlib-injector`, se comprueban librerías de Fabric y `ProcessBuilder` construye argumentos, classpath/mod list y ejecuta Java con `child_process.spawn`.
8. La instancia vive en `<dataDirectory>/instances/<serverId>`; salida stdout/stderr y código final se reflejan en consola y `minecraft_launch.log`. Discord Rich Presence se inicia si la distribución lo configura.

## Estado Actual y Modificaciones Recientes

- Implementado:
  - Login exclusivo Ely.by con usuario/correo, contraseña, 2FA, mensajes en español, alta/baja de cuentas y limpieza de campos sensibles.
  - Validación/refresco de tokens Ely.by; ante fallo de red se conserva la sesión local para permitir que el juego gestione el error.
  - Preview de skin/avatar Ely.by en login y en gestión de cuentas.
  - Distribución remota DomiFly con servidor Fabric 1.21.x, Java recomendado 21, RAM mínima/recomendada y módulos descargables con hashes.
  - Reparación/verificación de archivos, descarga automática de mods, assets y dependencias.
  - Detección/descarga automática de Java y persistencia del ejecutable por servidor.
  - Lanzamiento Fabric y compatibilidad heredada con Forge/LiteLoader mediante `ProcessBuilder`; selección de mods opcionales.
  - Descarga de `authlib-injector` con comprobación SHA-256 y conexión a la API de skins Ely.by.
  - Registro del lanzamiento y del proceso terminado en `minecraft_launch.log`; manejo de errores de cierre del juego.
  - Noticias RSS, estado de servicios Mojang, estado de jugadores del servidor, selección de servidor, settings y Discord RPC.
  - Actualizaciones automáticas con `electron-updater`; CI multiplataforma y empaquetado para Windows/macOS/Linux.
  - Mod Fabric `CustomMinecraft`: metadatos de Minecraft ~1.21/Java >=21, entrypoints cliente/main y mixins para título, loading overlay, logo, title screen y HUD.
- Adaptaciones clave respecto a Helios:
  - `distromanager.js` sustituye el índice de ejemplo por la distribución pública de DomiFly.
  - `authmanager.js` añade el backend Ely.by y aliases de métodos antiguos para evitar romper `settings.js`.
  - `app.ejs` omite la vista `loginOptions`; el flujo de UI entra directamente al login Ely.by.
  - `authlibinjector.js`, `fabrichelper.js` y el registro detallado del proceso son extensiones específicas de DomiFly.
  - La UI y los textos contienen personalizaciones DomiFly en español, aunque conserva claves y módulos heredados de Helios.

## Convenciones de Código y Reglas

- JavaScript CommonJS, indentación de 4 espacios, nombres camelCase y módulos con `require`/`exports`.
- Vistas EJS se componen desde `app.ejs`; la comunicación entre proceso principal y renderer usa IPC (`ipcMain`/`ipcRenderer`).
- Estado persistente centralizado en `ConfigManager`, JSON en `app.getPath('userData')/config.json`; migración de un path legacy bajo `APPDATA`/`HOME/.helioslauncher`.
- Datos de juego separados en `dataDirectory/common` (assets/libraries) e `dataDirectory/instances/<serverId>` (instancia por servidor). El nombre temporal de natives es `WCNatives`.
- Configuración externa preferida: la distribución define servidores, versiones, módulos, Java, RAM, RSS y Discord; el código resuelve defaults y sincroniza configuraciones de mods.
- Errores: `try/catch` en fronteras de red/proceso, logging mediante `LoggerUtil`, mensajes de usuario mediante overlays; algunas descargas auxiliares (`FabricHelper`) registran warning y continúan.
- Red: módulo nativo `https` para Ely.by y descargas personalizadas; se manejan timeouts y redirects básicos. Las descargas del índice/reparación delegan en `helios-core`.
- Seguridad/operación: las contraseñas no se guardan; tokens sí se persisten. El renderer tiene `nodeIntegration: true` y `contextIsolation: false`, una decisión heredada que aumenta la superficie de seguridad.
- Java: se valida contra el rango semver de la distribución; `ProcessBuilder` soporta classpath por plataforma, Forge/Fabric/LiteLoader y oculta el access token al registrar argumentos.
- Calidad: ESLint 9 con `npm run lint`; no hay suite de tests automatizados visible en la raíz.

## Pendientes y Próximos Pasos (Roadmap)

- Sustituir placeholders de producción en `distribution.json` (por ejemplo `TU_DISCORD_APP_ID_AQUI`) o mantener ese archivo claramente como ejemplo; la fuente efectiva actual es la URL remota.
- Resolver la divergencia de branding/producto entre `package.json` (`DomiFly Launcher`) y `electron-builder.yml`/README (`Helios Launcher`).
- Retirar o aislar completamente el flujo Microsoft/Mojang heredado: `index.js`, `loginOptions.js` y partes de `settings.js` aún contienen IPC, textos y ramas no operativas para Ely.by.
- Revisar la duplicación/contrato del argumento de `authlib-injector` entre `landing.js`, `ProcessBuilder` y `AuthlibInjector`, y centralizar su generación.
- Reemplazar el acoplamiento directo `DistroAPI['commonDir']`/`instanceDir` del preloader (marcado `TODO Fix this`) por una API explícita.
- Refactorizar `landing.js` y `ProcessBuilder`: hay TODOs de callback hell, separación de responsabilidades, manejo de errores y limpieza de funciones.
- Hacer que errores de descarga de librerías Fabric sean bloqueantes cuando la librería sea necesaria; actualmente `FabricHelper` solo registra warnings.
- Revisar el flujo de actualización: rutas/branding de releases aún apuntan a Helios y en macOS el autoupdate se desactiva para descarga manual.
- Actualizar README y documentación para Ely.by/DomiFly, Fabric 1.21.x y la distribución real; la documentación actual describe principalmente Microsoft/Helios.
- Añadir pruebas automatizadas para autenticación, persistencia/migración de configuración, resolución de mods, distribución, Java y construcción de argumentos.
- Evaluar endurecimiento de Electron (`contextIsolation`, preload bridge, CSP y eliminación de `@electron/remote`) antes de distribuir ampliamente.