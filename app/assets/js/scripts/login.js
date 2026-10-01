/**
 * ==============================================================================
 * SCRIPT DE INICIO DE SESIÓN - DOMIFLY MINECRAFT (ELY.BY)
 * ==============================================================================
 * Este archivo se encarga de:
 * 1. Capturar los datos que el usuario escribe (usuario, contraseña y 2FA).
 * 2. Conectarse a los servidores de Ely.by a través de AuthManager.
 * 3. Mostrar errores en pantalla si la contraseña es incorrecta o falta información.
 * 4. Si el login es exitoso, guardar la sesión y pasar a la pantalla del juego (landing).
 * 5. Abrir el navegador si el usuario hace clic en "Crear cuenta en Ely.by".
 * ==============================================================================
 */

// Usamos una función anónima autoejecutable (IIFE) para aislar las variables
// y evitar que choquen con otros scripts del launcher (como uicore.js o landing.js).
(function () {

    // shell: Módulo de Electron que permite abrir enlaces en el navegador predeterminado de Windows.
    const { shell } = require('electron')

    // AuthManager: Módulo que maneja las peticiones HTTP seguras con la API de Ely.by.
    const AuthManager = require('./assets/js/authmanager')

    // --------------------------------------------------------------------------
    // ELEMENTOS DEL HTML (Obtenidos mediante su ID definido en login.ejs)
    // --------------------------------------------------------------------------
    const userInput    = document.getElementById('loginUsername')   // Campo de texto para usuario o correo
    const passInput    = document.getElementById('loginPassword')   // Campo de texto para la contraseña
    const totpGroup    = document.getElementById('loginTotpGroup')  // Contenedor del campo 2FA (oculto por defecto)
    const totpInput    = document.getElementById('loginTotp')       // Campo para el código 2FA
    const errorLabel   = document.getElementById('loginError')      // Texto rojo donde se muestran los errores
    const loginButton  = document.getElementById('loginButton')     // Botón principal "Entrar al servidor"
    const registerLink = document.getElementById('loginRegister')   // Enlace azul "Crear cuenta en Ely.by"
    const avatarImg    = document.getElementById('loginAvatarImg')   // Imagen del avatar/skin preview
    const avatarBadge  = document.getElementById('loginAvatarBadge') // Etiqueta de skin detectada
    const avatarBox    = document.getElementById('loginAvatarBox')   // Borde con efecto glow del avatar

    // Texto predeterminado que muestra el botón cuando no está cargando
    const BUTTON_TEXT = 'Entrar al servidor'

    // Variables de control de estado:
    let needsTotp = false // ¿La cuenta de Ely.by tiene activada la verificación en dos pasos (2FA)?
    let busy      = false // ¿Hay una petición de inicio de sesión en curso? (evita clics dobles)

    // --------------------------------------------------------------------------
    // FUNCIONES AUXILIARES
    // --------------------------------------------------------------------------

    /**
     * Muestra o limpia un mensaje de error debajo de los campos de texto.
     * @param {string} message - El texto de error a mostrar. Si está vacío, se limpia.
     */
    function setError(message) {
        errorLabel.textContent = message || ''
    }

    /**
     * Bloquea o desbloquea los campos mientras se valida la cuenta.
     * Si value es true, desactiva el botón y pone el texto "Conectando...".
     * @param {boolean} value
     */
    function setBusy(value) {
        busy = value
        loginButton.disabled = value
        loginButton.textContent = value ? 'Conectando...' : BUTTON_TEXT
        userInput.disabled = value
        passInput.disabled = value
        totpInput.disabled = value
    }

    /**
     * Muestra el campo de verificación en dos pasos (2FA) y pone el cursor en él.
     */
    function showTotp() {
        needsTotp = true
        totpGroup.style.display = 'block'
        totpInput.focus()
    }

    /**
     * Actualiza la vista previa del avatar y badge según el usuario escrito.
     * @param {string} username Nickname escrito por el usuario.
     */
    function updateSkinPreview(username) {
        if (!username || !username.trim()) {
            if (avatarImg) avatarImg.src = 'assets/images/SealCircle.png'
            if (avatarBadge) avatarBadge.style.display = 'none'
            if (avatarBox) avatarBox.style.borderColor = '#2f7bf5'
            return
        }

        const clean = username.trim()
        SkinManager.getSkinDetails(clean).then((details) => {
            if (avatarImg) {
                avatarImg.src = details.avatar
            }
            if (avatarBadge) {
                avatarBadge.style.display = 'inline-block'
                if (details.hash && details.hash !== 'steve') {
                    avatarBadge.textContent = 'Skin de Ely.by vinculada'
                    avatarBadge.style.color = '#4ade80'
                    avatarBadge.style.borderColor = 'rgba(74, 222, 128, 0.28)'
                    avatarBadge.style.background = 'rgba(74, 222, 128, 0.12)'
                    if (avatarBox) avatarBox.style.borderColor = '#4ade80'
                } else {
                    avatarBadge.textContent = 'Cuenta de Ely.by'
                    avatarBadge.style.color = '#60a5fa'
                    avatarBadge.style.borderColor = 'rgba(96, 165, 250, 0.28)'
                    avatarBadge.style.background = 'rgba(96, 165, 250, 0.12)'
                    if (avatarBox) avatarBox.style.borderColor = '#2f7bf5'
                }
            }
        }).catch(() => {})
    }

    // --------------------------------------------------------------------------
    // FUNCIÓN PRINCIPAL DE INICIO DE SESIÓN
    // --------------------------------------------------------------------------
    async function doLogin() {
        // Si ya está procesando un intento de login, no hacer nada para evitar saturación
        if (busy) return

        // Obtenemos los valores escritos por el usuario (quitando espacios en blanco innecesarios)
        const user = userInput.value.trim()
        const pass = passInput.value
        const totp = totpInput.value.trim()

        // Validación 1: Verificar que no deje los campos vacíos
        if (!user || !pass) {
            setError('Escribe tu usuario o correo y tu contraseña de Ely.by.')
            return
        }

        // Validación 2: Si la cuenta requiere 2FA, verificar que haya escrito el código
        if (needsTotp && !totp) {
            setError('Escribe el código de verificación en dos pasos.')
            totpInput.focus()
            return
        }

        // Limpiar cualquier error previo y activar el estado "Cargando..."
        setError('')
        setBusy(true)

        try {
            // Enviamos las credenciales a Ely.by y guardamos el token de sesión
            const account = await AuthManager.addElyAccount(user, pass, needsTotp ? totp : undefined)

            // Limpiamos los campos de la contraseña por seguridad
            passInput.value = ''
            totpInput.value = ''
            needsTotp = false
            totpGroup.style.display = 'none'

            // Actualizamos el nombre de usuario y el avatar en la pantalla principal (landing)
            if (typeof updateSelectedAccount === 'function') {
                updateSelectedAccount(account)
            }

            // Desbloqueamos el botón y cambiamos de pantalla hacia la interfaz del juego
            setBusy(false)
            switchView(getCurrentView(), VIEWS.landing, 500, 500)

        } catch (err) {
            // Si hubo un error (contraseña mala, sin internet, etc.):
            setBusy(false)

            // Si el servidor de Ely.by nos indica que la cuenta tiene 2FA activado:
            if (AuthManager.requiresTwoFactor(err) && !needsTotp) {
                showTotp()
            }

            // Mostramos el mensaje de error legible al usuario
            setError(AuthManager.describeError(err))
            console.error('[login] Error al iniciar sesión con Ely.by:', err)
        }
    }

    // --------------------------------------------------------------------------
    // ASIGNACIÓN DE EVENTOS (LISTENERS)
    // --------------------------------------------------------------------------

    // 1. Al hacer clic en el botón "Entrar al servidor" -> Ejecutar doLogin()
    loginButton.addEventListener('click', doLogin)

    // 2. Al presionar la tecla Enter en cualquiera de los campos -> Ejecutar doLogin()
    for (const input of [userInput, passInput, totpInput]) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doLogin()
        })
    }

    // 3. Al hacer clic en "Crear cuenta en Ely.by" -> Abrir la web de registro en el navegador
    registerLink.addEventListener('click', (e) => {
        e.preventDefault()
        shell.openExternal('https://account.ely.by/register')
    })

    // 4. Al escribir el usuario o correo -> Previsualizar la skin de Ely.by en tiempo real
    let skinDebounceTimer = null
    userInput.addEventListener('input', () => {
        clearTimeout(skinDebounceTimer)
        skinDebounceTimer = setTimeout(() => {
            updateSkinPreview(userInput.value)
        }, 350)
    })

    // Si el campo ya tiene un valor cargado previamente, previsualizar la skin de inmediato
    if (userInput.value) {
        updateSkinPreview(userInput.value)
    }

})()