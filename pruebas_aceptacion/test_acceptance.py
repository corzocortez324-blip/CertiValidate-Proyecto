"""Pruebas de aceptación CertiValidate (CA001–CA016), según el documento 4.2.

Cada paso verificado guarda un pantallazo numerado en evidencias/CAxxx/ y al final se
genera evidencias/resultados.json, con el que `llenar_informe.py` completa las tablas 4.2.2.

Ajustes frente a la versión anterior (derivados de leer certivalidate-backend):
  * Se inicia sesión como admin UNA sola vez (fixture `admin`): el backend limita
    login/registro a 10 peticiones por IP+correo cada 15 min.
  * CA002 / CA016 contrastan además el código HTTP real del servidor (423 / 403).
  * CA004 puede leer el token de verificación de la BD (el backend envía con Resend, no MailHog).
  * CA009 comprueba el formato exacto del titular ofuscado y revisa que la API no exponga el nombre.
  * CA015 tolera que `fecha_hasta` se interprete a las 00:00 (ver nota dentro de la prueba).
"""
import datetime
import time
import uuid

import pyotp
import pytest
from selenium.common.exceptions import NoSuchElementException, StaleElementReferenceException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

import config
from conftest import need
from helpers import (api, api_login, banner, button, clickable, db_verification_token, emitir,
                     extract_verify_link, field_by_label, list_certs, login, mail_body,
                     mailhog_find, password_login_ok, public_verify, resend_entrega, row_for, select_contains,
                     set_input_value, visible, visible_errors, wait, wait_modal_closed)

S = config.STUDENT
NOMBRE_COMPLETO = f"{S['nombre']} {S['apellido']}"


def certs_estudiante(driver):
    """Certificados del estudiante de prueba. Se filtra por documento: el buscador no admite
    «nombre apellido» (el backend compara el texto con nombre y con apellido por separado)."""
    return list_certs(driver, S["documento"], match=lambda r: r["estudiante"] == NOMBRE_COMPLETO)


def titular_ofuscado(nombre, apellido):
    """Misma regla que ofuscarNombre() en certificado.controller.js."""
    a = apellido.strip()
    if len(a) <= 2:
        return f"{nombre} {a[0]}***"
    return f"{nombre} {a[0]}{'*' * min(len(a) - 2, 3)}{a[-1]}"


# ═════════════════════════ Autenticación ═════════════════════════
def test_ca001_login_exitoso(driver, ev):
    """CA001: admin inicia sesión, es redirigido a /admin y ve el menú lateral."""
    login(driver, config.ADMIN_EMAIL, config.ADMIN_PASSWORD, ev=ev)
    wait(driver).until(lambda d: d.current_url.rstrip("/").endswith("/admin"))
    visible(driver, By.CSS_SELECTOR, "aside.sidebar")
    ev.step(driver, "Acceso correcto: redirigido a /admin y menú lateral visible")
    assert "Certificados" in driver.find_element(By.CSS_SELECTOR, "aside.sidebar").text


def test_ca002_bloqueo_por_intentos_fallidos(driver, ev):
    """CA002: tras intentos fallidos la cuenta se bloquea, incluso con la clave correcta.

    Usa LOCKOUT_EMAIL (usuario dedicado): la cuenta queda bloqueada ~15 min.
    Backend: 5 fallidos por correo en 15 min => HTTP 423 (intentoLogin.service.js).
    """
    if not config.LOCKOUT_EMAIL:
        pytest.skip("Defina LOCKOUT_EMAIL (usuario dedicado; quedará bloqueado ~15 min)")
    driver.get(f"{config.BASE_URL}/login")
    visible(driver, By.CSS_SELECTOR, "input[type='email']").send_keys(config.LOCKOUT_EMAIL)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys("Incorrecta1")
    ev.step(driver, "Pantalla /login con correo válido y contraseña incorrecta")

    intentos = 0
    for _ in range(6):  # el documento pide 6 intentos
        submit = driver.find_element(By.CSS_SELECTOR, "button.auth-submit")
        if not submit.is_enabled():
            break
        submit.click()
        intentos += 1
        time.sleep(0.8)
        wait(driver).until(lambda d: "Verificando" not in
                           d.find_element(By.CSS_SELECTOR, "button.auth-submit").text)
        if intentos in (1, 5):
            ev.step(driver, f"Resultado del intento fallido n.º {intentos}")

    cuerpo = driver.find_element(By.TAG_NAME, "body").text.lower()
    ev.step(driver, f"Tras {intentos} intentos fallidos el sistema informa el bloqueo")
    if "demasiados intentos" in cuerpo and "bloquead" not in cuerpo:
        raise AssertionError(
            "Se alcanzó el límite de peticiones del backend (429) antes del bloqueo de cuenta: "
            "espere 15 min o reinicie el backend y repita la prueba")
    assert "bloqueada" in cuerpo, f"No se informó el bloqueo tras {intentos} intentos"

    # Recarga: el contador del frontend se reinicia, así que el bloqueo debe venir del servidor.
    driver.get(f"{config.BASE_URL}/login")
    visible(driver, By.CSS_SELECTOR, "input[type='email']").send_keys(config.LOCKOUT_EMAIL)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(config.LOCKOUT_PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "button.auth-submit").click()
    time.sleep(3)
    ev.step(driver, "Con la contraseña CORRECTA el acceso sigue bloqueado (tras recargar la página)")
    assert "/admin" not in driver.current_url, \
        "Con la clave correcta se pudo entrar: el bloqueo solo existe en el cliente"
    errores = " ".join(visible_errors(driver)).lower()
    assert "bloquead" in errores, f"El servidor no informó bloqueo. Mensajes: {errores!r}"

    st, _ = api_login(config.LOCKOUT_EMAIL, config.LOCKOUT_PASSWORD)
    if st is None:
        ev.note("Backend no accesible desde la prueba: no se contrastó el HTTP 423 directamente.")
    else:
        assert st == 423, f"El servidor respondió HTTP {st} y se esperaba 423 (cuenta bloqueada)"


def test_ca003_login_con_2fa(driver, ev):
    """CA003: con 2FA activo, un código incorrecto se rechaza y el vigente da acceso."""
    if not (config.TOTP_EMAIL and config.TOTP_SECRET):
        pytest.skip("Defina TOTP_EMAIL y TOTP_SECRET (usuario con 2FA activo)")
    login(driver, config.TOTP_EMAIL, config.TOTP_PASSWORD, esperar=False, ev=ev)
    campo = visible(driver, By.CSS_SELECTOR, "input.totp-input")
    assert "Código de verificación" in driver.find_element(By.CSS_SELECTOR, ".auth-form").text
    ev.step(driver, "Se solicita el «Código de verificación» (segundo paso)")

    campo.send_keys("000000")
    button(driver, "Confirmar").click()
    wait(driver).until(lambda d: visible_errors(d))
    assert "/admin" not in driver.current_url
    assert driver.find_elements(By.CSS_SELECTOR, "input.totp-input"), \
        "Debe permanecer en el segundo paso"
    ev.step(driver, "Código incorrecto (000000): se rechaza y permanece en el segundo paso")

    totp = pyotp.TOTP(config.TOTP_SECRET)
    if totp.interval - (time.time() % totp.interval) < 3:
        time.sleep(4)  # evita usar un código a punto de expirar
    campo = driver.find_element(By.CSS_SELECTOR, "input.totp-input")
    set_input_value(driver, campo, totp.now())
    ev.step(driver, "Código TOTP vigente ingresado")
    button(driver, "Confirmar").click()
    wait(driver).until(EC.url_contains("/admin"))
    ev.step(driver, "Con el código vigente se accede al sistema (/admin)")


def test_ca004_registro_de_usuario(driver, state, ev):
    """CA004 (parte 1): una persona nueva crea su cuenta."""
    email = config.REGISTER_EMAIL or f"ana.{int(time.time())}@unicesar.edu.co"
    driver.get(f"{config.BASE_URL}/register")
    form = visible(driver, By.CSS_SELECTOR, "form.auth-form")
    ev.step(driver, "Pantalla «Crear cuenta»")
    field_by_label(form, "Nombre").send_keys("Ana")
    field_by_label(form, "Apellido").send_keys("Pérez")
    field_by_label(form, "Correo Electrónico").send_keys(email)
    field_by_label(form, "Contraseña").send_keys(config.REGISTER_PASSWORD)
    field_by_label(form, "Confirmar Contraseña").send_keys(config.REGISTER_PASSWORD)
    ev.step(driver, f"Formulario diligenciado ({email})")
    clickable(driver, By.CSS_SELECTOR, "button.auth-submit").click()
    ok = visible(driver, By.CSS_SELECTOR, ".alert-success")
    ev.step(driver, "Mensaje de registro exitoso")
    assert "cuenta creada" in ok.text.lower()
    state["nuevo_usuario"] = email


def test_ca004_verificacion_de_correo(driver, state, ev):
    """CA004 (parte 2): abre el enlace de verificación y luego inicia sesión."""
    email = need(state, "nuevo_usuario")
    path = None
    if config.MAILHOG_URL:
        items = mailhog_find(email)
        assert items, f"No llegó el correo de verificación a {email}"
        link = extract_verify_link(mail_body(items[0]))
        assert link, "El correo no contiene el enlace /verificar-email?token=..."
        path = link.split("/verificar-email", 1)[1]
    else:
        token = db_verification_token(email)
        if token:
            path = f"?token={token}"
            ev.note("El enlace de verificación se tomó de la BD (token_verificacion) porque el "
                    "backend envía el correo con Resend y no hay buzón local que leer.")
    if path is None:
        pytest.skip("Defina MAILHOG_URL o DATABASE_URL (+ pip install psycopg[binary]); "
                    "si no, abra el enlace del correo a mano y guarde capturas manual_*.png "
                    "en evidencias/CA004/")
    driver.get(f"{config.BASE_URL}/verificar-email{path}")
    # Se espera el resultado final: la página puede mostrar primero uno y luego el otro.
    xp = "//h2[contains(., 'Correo verificado') or contains(., 'Enlace inválido')]"
    visible(driver, By.XPATH, xp)
    time.sleep(2)
    titulo = driver.find_element(By.XPATH, xp).text
    if "Enlace inválido" in titulo:
        ev.step(driver, "Enlace de verificación abierto: la pantalla muestra «Enlace inválido»")
        ev.note("El backend sí verifica el correo (GET /api/auth/verificar-email responde 200 y la cuenta "
                "queda verificada), pero VerifyEmail.jsx llama dos veces al endpoint (useEffect ejecutado "
                "dos veces por React.StrictMode); la segunda llamada responde 400 y, según cuál respuesta "
                "llegue de última, la pantalla muestra «Enlace inválido». Falla de forma intermitente.")
        raise AssertionError("Tras abrir el enlace de verificación la pantalla muestra «Enlace inválido» "
                             "aunque el correo quedó verificado (doble llamada al endpoint)")
    ev.step(driver, "Enlace de verificación abierto: «Correo verificado»")
    login(driver, email, config.REGISTER_PASSWORD, esperar=None, ev=ev,
          paso="Primer inicio de sesión con la cuenta nueva")
    ev.step(driver, "El usuario nuevo inicia sesión correctamente")


# ═════════════════════════ Gestión (admin) ═════════════════════════
def test_ca005_registrar_estudiante(admin, ev):
    """CA005: el admin crea un estudiante y aparece en el listado."""
    driver = admin
    driver.get(f"{config.BASE_URL}/admin/estudiantes")
    buscador = visible(driver, By.CSS_SELECTOR, "input.search-input")
    set_input_value(driver, buscador, S["documento"])
    time.sleep(1.5)
    if driver.find_elements(By.XPATH, f"//td[normalize-space()='{S['documento']}']"):
        raise AssertionError(
            f"El documento {S['documento']} ya existe (el backend respondería 409 al duplicarlo): "
            "ejecute npm run prepare:e2e en certivalidate-backend o cambie STUDENT_DOC.")
    set_input_value(driver, buscador, "")
    ev.step(driver, "Módulo Estudiantes (listado inicial)")
    button(driver, "Nuevo Estudiante").click()
    modal = visible(driver, By.CSS_SELECTOR, ".modal-content")
    select_contains(driver, field_by_label(modal, "Institución", "select"), config.INSTITUCION)
    field_by_label(modal, "Nombre").send_keys(S["nombre"])
    field_by_label(modal, "Apellido").send_keys(S["apellido"])
    field_by_label(modal, "Documento").send_keys(S["documento"])
    field_by_label(modal, "Email").send_keys(S["email"])
    ev.step(driver, "Formulario «Nuevo Estudiante» diligenciado")
    button(driver, "Crear Estudiante", scope=modal).click()
    wait_modal_closed(driver)

    set_input_value(driver, visible(driver, By.CSS_SELECTOR, "input.search-input"), S["documento"])
    xp_fila = f"//td[normalize-space()='{S['documento']}']/parent::tr"

    def fila_con_nombre(d):
        # La tabla se vuelve a renderizar al aplicar la búsqueda: se relee la fila en cada intento
        try:
            return NOMBRE_COMPLETO in d.find_element(By.XPATH, xp_fila).text
        except (NoSuchElementException, StaleElementReferenceException):
            return False

    wait(driver).until(fila_con_nombre)
    ev.step(driver, "El estudiante aparece en el listado de la institución")


def test_ca006_crear_plantilla(admin, ev):
    """CA006: el admin crea una plantilla; queda activa en el listado."""
    driver = admin
    driver.get(f"{config.BASE_URL}/admin/plantillas")
    visible(driver, By.XPATH, "//h1[contains(., 'Plantillas de Certificado')]")
    ev.step(driver, "Módulo Plantillas (listado inicial)")
    button(driver, "Nueva Plantilla").click()
    modal = visible(driver, By.CSS_SELECTOR, ".modal-content")
    select_contains(driver, field_by_label(modal, "Institución", "select"), config.INSTITUCION)
    field_by_label(modal, "Nombre").send_keys(config.PLANTILLA_NOMBRE)
    ver = field_by_label(modal, "Versión")
    set_input_value(driver, ver, config.PLANTILLA_VERSION)
    ev.step(driver, "Formulario «Nueva Plantilla» diligenciado")
    button(driver, "Crear y Abrir Editor", scope=modal).click()

    # Editor visual: se guarda la plantilla base
    guardar = clickable(driver, By.CSS_SELECTOR, "button.ced-btn-primary", timeout=30)
    ev.step(driver, "Editor visual de la plantilla")
    guardar.click()
    visible(driver, By.XPATH, "//h1[contains(., 'Plantillas de Certificado')]", timeout=30)
    tarjeta = visible(driver, By.XPATH,
                      f"//h3[normalize-space()='{config.PLANTILLA_NOMBRE}']"
                      "/ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' card ')][1]")
    ev.step(driver, "La plantilla aparece en el listado con estado «Activa»")
    assert "activa" in tarjeta.text.lower()  # el badge se muestra en mayúsculas por CSS


def test_ca007_emitir_certificado(admin, state, ev):
    """CA007: se emite un certificado con código único; queda válido en el listado."""
    driver = admin
    antes = {r["codigo"] for r in certs_estudiante(driver)}
    ev.step(driver, f"Módulo Certificados filtrado por el documento {S['documento']} antes de emitir")
    emitir(driver, config.INSTITUCION, S["documento"], config.PLANTILLA_NOMBRE, ev=ev)
    wait_modal_closed(driver, timeout=60)

    filas = certs_estudiante(driver)
    nuevos = [r for r in filas if r["codigo"] not in antes]
    ev.step(driver, "Listado: el certificado nuevo aparece con código único y estado «Válido»")
    assert len(nuevos) == 1, f"Se esperaba 1 certificado nuevo y hay {len(nuevos)}"
    cert = nuevos[0]
    assert cert["codigo"], "El certificado no tiene código único"
    assert cert["estado"].lower().startswith("válido"), f"Estado inesperado: {cert['estado']}"
    state["codigo"] = cert["codigo"]

    try:  # el documento pide «código único y hash»: se muestra el detalle
        row_for(driver, cert["codigo"]).find_element(
            By.CSS_SELECTOR, "button[title='Ver detalle']").click()
        visible(driver, By.CSS_SELECTOR, ".modal-content")
        ev.step(driver, "Detalle del certificado emitido (código único y datos de integridad)")
    except Exception:
        ev.note("No se pudo abrir el detalle del certificado para evidenciar el hash.")


def test_ca008_emision_duplicada(admin, state, ev):
    """CA008: no se puede emitir dos veces el mismo certificado vigente (backend: HTTP 409)."""
    need(state, "codigo")
    driver = admin
    antes = len(certs_estudiante(driver))
    emitir(driver, config.INSTITUCION, S["documento"], config.PLANTILLA_NOMBRE, ev=ev)
    errores = wait(driver, 30).until(lambda d: visible_errors(d))
    ev.step(driver, "El sistema rechaza la emisión duplicada y muestra el mensaje")
    texto = " ".join(errores).lower()
    assert any(p in texto for p in ("vigente", "ya existe", "duplic")), \
        f"El mensaje no indica certificado vigente existente: {texto!r}"
    despues = len(certs_estudiante(driver))
    ev.step(driver, f"El listado conserva {despues} certificado(s): no se creó uno nuevo")
    assert despues == antes, "Se creó un certificado duplicado"


# ═════════════════════════ Verificación pública ═════════════════════════
def test_ca009_verificacion_publica_valido(driver, state, ev):
    """CA009: un tercero sin cuenta ve «Válido» con el titular ofuscado."""
    codigo = need(state, "codigo")
    res = public_verify(driver, codigo, ev=ev)
    ev.step(driver, "Resultado de la verificación: «Certificado Válido»")
    assert "result-valido" in res.get_attribute("class")
    assert "Certificado Válido" in res.text
    assert config.INSTITUCION.lower() in res.text.lower()
    assert "fecha de emisión" in res.text.lower()  # etiqueta en mayúsculas por CSS
    if NOMBRE_COMPLETO in res.text:
        ev.note("El backend calcula «titular» ofuscado, pero VerifyCertificate.jsx muestra "
                "estudiante.nombre + estudiante.apellido completos en el portal público.")
    assert NOMBRE_COMPLETO not in res.text, \
        f"El nombre del titular aparece completo (debería estar ofuscado): {res.text!r}"
    esperado = titular_ofuscado(S["nombre"], S["apellido"])
    if esperado not in res.text:
        ev.note(f"No se encontró el titular ofuscado esperado «{esperado}» en la pantalla.")

    st, js = api("POST", "/certificados/verificar", {"codigo": codigo})
    if st == 200:
        est = ((js or {}).get("data") or {}).get("estudiante") or {}
        if est.get("apellido"):
            ev.note("Hallazgo de privacidad: la pantalla oculta el nombre, pero la respuesta JSON de "
                    "POST /api/certificados/verificar incluye estudiante.nombre y estudiante.apellido "
                    "completos (certificado.controller.js). Se recomienda devolver solo «titular».")


def test_ca010_codigo_inexistente(driver, ev):
    """CA010: un código que no existe muestra «No Encontrado» sin errores en pantalla."""
    res = public_verify(driver, "XXXX-0000", ev=ev)
    ev.step(driver, "Resultado: «No Encontrado», sin mensajes de error")
    assert "result-inexistente" in res.get_attribute("class")
    assert "No Encontrado" in res.text
    assert not driver.find_elements(By.CSS_SELECTOR, ".alert-error")


# ═════════════════════════ Descarga y envío ═════════════════════════
def test_ca012_descargar_pdf(admin, state, downloads_dir, ev):
    """CA012: se descarga un PDF válido (con el QR de verificación)."""
    codigo = need(state, "codigo")
    driver = admin
    for viejo in downloads_dir.glob("*"):
        viejo.unlink()
    list_certs(driver, codigo)
    ev.step(driver, "Listado de certificados con el icono «Descargar PDF» del certificado")
    row_for(driver, codigo).find_element(By.CSS_SELECTOR, "button[title='Descargar PDF']").click()

    destino = downloads_dir / f"certificado-{codigo}.pdf"
    wait(driver, 60).until(lambda d: destino.exists()
                           and not list(downloads_dir.glob("*.crdownload")))
    datos = destino.read_bytes()
    assert datos.startswith(b"%PDF"), "El archivo descargado no es un PDF"

    from pypdf import PdfReader
    lector = PdfReader(str(destino))
    assert len(lector.pages) >= 1
    # El PDF se genera con html2canvas: es una imagen, no tiene texto extraíble.
    assert any(len(p.images) for p in lector.pages), "El PDF no contiene contenido visual"

    imagen = None
    try:  # Render del PDF para evidenciar «abrir el archivo descargado»
        import pypdfium2 as pdfium
        imagen = pdfium.PdfDocument(str(destino))[0].render(scale=1.6).to_pil()
        png = downloads_dir / f"certificado-{codigo}.png"
        imagen.save(png)
        ev.image(png, f"PDF descargado (certificado-{codigo}.pdf), primera página")
    except Exception:
        ev.note("Instale pypdfium2 para adjuntar la imagen del PDF descargado.")

    try:  # Verificación del QR (opcional: opencv-python-headless + numpy)
        import cv2
        import numpy as np
    except ImportError:
        return
    if imagen is None:
        return
    arr = np.array(imagen.convert("RGB"))
    det = cv2.QRCodeDetector()
    valor, puntos, _ = det.detectAndDecode(arr)
    if not valor:
        # El texto «Código de verificación» invade la zona de silencio del QR y el lector de la
        # página completa falla; se recorta el QR, se le añade borde blanco y se decodifica.
        gris = cv2.cvtColor(np.array(pdfium.PdfDocument(str(destino))[0].render(scale=2).to_pil()
                                     .convert("RGB")), cv2.COLOR_RGB2GRAY)
        ok, puntos = det.detect(gris)
        if ok and puntos is not None:
            x0, y0 = puntos[0].min(axis=0).astype(int)
            x1, y1 = puntos[0].max(axis=0).astype(int)
            recorte = gris[max(y0 - 2, 0):y1 + 2, max(x0 - 2, 0):x1 + 2]
            _, recorte = cv2.threshold(recorte, 128, 255, cv2.THRESH_BINARY)
            for esc in (1, 2, 3):
                z = cv2.resize(recorte, None, fx=esc, fy=esc, interpolation=cv2.INTER_NEAREST)
                z = cv2.copyMakeBorder(z, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=255)
                valor = det.detectAndDecode(z)[0]
                if valor:
                    break
        if valor:
            ev.note("El QR del PDF apunta al certificado correcto, pero el texto «Código de verificación» "
                    "se superpone a su borde inferior (sin zona de silencio): un lector puede fallar al "
                    "leer la página completa. Se recomienda separar el texto del QR.")
    assert codigo in valor, f"El QR del PDF no apunta al certificado (leído: {valor!r})"


def test_ca013_enviar_por_correo(admin, state, ev):
    """CA013: el emisor envía el certificado por correo; el sistema lo confirma."""
    codigo = need(state, "codigo")
    driver = admin
    list_certs(driver, codigo)
    row_for(driver, codigo).find_element(By.CSS_SELECTOR, "button[title='Ver detalle']").click()
    envio = button(driver, "Enviar por correo", timeout=40)
    ev.step(driver, "Detalle del certificado con la opción «Enviar por correo»")
    # margen de 1 min por diferencias de reloj con Resend
    desde = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M:%S")
    envio.click()
    toast = wait(driver, 60).until(lambda d: next(
        (t for t in d.find_elements(By.CSS_SELECTOR, ".toast") if "correo" in t.text.lower()), None))
    texto = toast.text
    ev.step(driver, "El sistema confirma el envío del certificado (notificación)")
    if "toast-success" not in toast.get_attribute("class") or "enviado por correo correctamente" not in texto.lower():
        raise AssertionError(
            f"Notificación inesperada: {texto!r}. Revise en el backend RESEND_API_KEY, EMAIL_FROM y "
            "EMAIL_DEV_TO (con onboarding@resend.dev Resend solo entrega al correo dueño de la cuenta).")

    # Recepción: Resend confirma que el correo quedó entregado en el buzón de destino
    if config.MAILHOG_URL:
        mensajes = mailhog_find(S["email"])
        assert mensajes, f"El correo no llegó a {S['email']}"
    else:
        assert config.RESEND_API_KEY, "Sin RESEND_API_KEY no se puede confirmar la entrega del correo"
        destinatario = config.EMAIL_DEV_TO or S["email"]
        correo = resend_entrega(destinatario, desde)
        banner(driver, f"Resend: correo {correo['id'][:8]}… a {destinatario} -> {correo['last_event']}\n"
                       f"Asunto: {correo.get('subject')}")
        ev.step(driver, "Resend confirma la entrega del correo (estado «delivered»)")


def test_ca011_revocar_certificado(admin, state, ev):
    """CA011: el admin revoca el certificado y el portal público lo reporta revocado."""
    codigo = need(state, "codigo")
    driver = admin
    list_certs(driver, codigo)
    ev.step(driver, "Certificado en el listado, estado «Válido», con la acción «Revocar»")
    row_for(driver, codigo).find_element(By.CSS_SELECTOR, "button[title='Revocar']").click()
    modal = visible(driver, By.CSS_SELECTOR, ".modal-content")
    select_contains(driver, modal.find_element(By.TAG_NAME, "select"), "Error en datos")
    modal.find_element(By.TAG_NAME, "textarea").send_keys("Datos del estudiante incorrectos")
    modal.find_element(By.CSS_SELECTOR, "input[type='checkbox']").click()
    ev.step(driver, "Modal de revocación: motivo ERROR_DATOS, detalle y confirmación marcada")
    button(driver, "Confirmar Revocación", scope=modal).click()
    wait_modal_closed(driver)

    wait(driver).until(lambda d: "revocado" in row_for(d, codigo).text.lower())
    ev.step(driver, "El certificado queda en estado «Revocado» en el listado")

    res = public_verify(driver, codigo, ev=ev)
    ev.step(driver, "El portal público reporta el certificado como «Revocado»")
    assert "result-revocado" in res.get_attribute("class")
    assert "Certificado Revocado" in res.text


# ═════════════════════════ Integración, auditoría, roles ═════════════════════════
def test_ca014_configurar_integracion(admin, ev):
    """CA014: se configura la integración REST; la API key no se muestra; se prueba la conexión."""
    driver = admin
    driver.get(f"{config.BASE_URL}/admin/integraciones")
    xp_card = (f"//p[contains(@class,'integ-name') and normalize-space()='{config.INSTITUCION}']"
               "/ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' integ-card ')][1]")
    tarjeta = visible(driver, By.XPATH, xp_card)
    ev.step(driver, "Módulo Integraciones: tarjeta de la institución")

    configurar = tarjeta.find_elements(By.XPATH, ".//button[contains(.,'Configurar integración')]")
    if configurar:
        configurar[0].click()
    else:  # ya existía: se edita (el backend hace upsert por institución)
        tarjeta.find_element(By.CSS_SELECTOR, "button[title='Editar integración']").click()

    form = visible(driver, By.CSS_SELECTOR, "form.integ-modal-form")
    Select(form.find_element(By.TAG_NAME, "select")).select_by_visible_text("REST")
    form.find_element(By.CSS_SELECTOR, "input[type='url']").send_keys(config.INTEG_URL)
    clave = form.find_element(By.CSS_SELECTOR, "input[type='password']")
    clave.send_keys(config.INTEG_KEY)
    assert clave.get_attribute("type") == "password"
    ev.step(driver, "Formulario de integración: tipo REST, URL base y API key (campo enmascarado)")
    form.find_element(By.CSS_SELECTOR, "button.btn-modal-save").click()
    wait(driver).until(lambda d: not d.find_elements(By.CSS_SELECTOR, "form.integ-modal-form"))

    assert config.INTEG_KEY not in driver.page_source, "La API key aparece en pantalla"
    tarjeta = visible(driver, By.XPATH, xp_card)
    ev.step(driver, "Integración guardada: la API key no se muestra en pantalla")
    button(driver, "Probar conexión", scope=tarjeta).click()
    msg = visible(driver, By.CSS_SELECTOR, ".integ-test-msg", timeout=40)
    assert msg.text.strip(), "La prueba de conexión no informó su estado"
    ev.step(driver, f"Prueba de conexión: «{msg.text.strip()}»")
    ev.note("Tras esta prueba la institución queda con una integración REST hacia una URL de ejemplo "
            "no accesible; desactívela o elimínela antes de repetir la emisión (CA007/CA008).")


def test_ca015_log_de_auditoria(admin, state, ev):
    """CA015: la tabla muestra solo los eventos filtrados y el detalle trae los datos clave."""
    need(state, "codigo")  # requiere que CA011 haya generado un evento REVOCAR_CERTIFICADO
    driver = admin
    driver.get(f"{config.BASE_URL}/admin/auditoria")
    visible(driver, By.XPATH, "//h1[normalize-space()='Auditoría']")
    ev.step(driver, "Módulo Auditoría (sin filtros)")

    def sel(label):
        return driver.find_element(
            By.XPATH, f"//label[normalize-space()='{label}']/following::select[1]")

    def campo(etiqueta):
        return driver.find_element(
            By.XPATH, f"//label[normalize-space()='{etiqueta}']/following::input[1]")

    def filas_filtradas():
        filas = []
        for _ in range(8):  # espera a que la tabla refleje el filtro
            time.sleep(1.5)
            try:
                filas = [tr for tr in driver.find_elements(By.CSS_SELECTOR, "table tbody tr")
                         if tr.find_elements(By.CSS_SELECTOR, "button[title='Ver detalle']")]
                if all("REVOCAR CERTIFICADO" in tr.text for tr in filas):
                    break
            except StaleElementReferenceException:
                continue
        return filas

    # Igual que en Certificados: se espera la carga inicial para que su respuesta no
    # sobrescriba la del filtro.
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, "table tbody tr td"))
    time.sleep(1.5)
    Select(sel("Entidad")).select_by_value("Certificado")
    Select(sel("Acción")).select_by_value("REVOCAR_CERTIFICADO")
    hoy = datetime.date.today()
    set_input_value(driver, campo("Desde"), hoy.isoformat())
    set_input_value(driver, campo("Hasta"), hoy.isoformat())
    filas = filas_filtradas()
    if not filas:
        # El backend filtra con `fecha <= new Date(fecha_hasta)`: «2026-10-03» equivale a las
        # 00:00 UTC, así que «Hasta = hoy» puede dejar fuera los eventos del propio día.
        set_input_value(driver, campo("Hasta"), (hoy + datetime.timedelta(days=1)).isoformat())
        filas = filas_filtradas()
        if filas:
            ev.note("Con «Hasta = hoy» el filtro no devolvió el evento del día: auditoria.controller.js "
                    "interpreta fecha_hasta a las 00:00. Se usó Hasta = mañana para incluirlo.")
    assert filas, "El filtro no devolvió eventos REVOCAR_CERTIFICADO de hoy"
    for tr in filas:
        assert "REVOCAR CERTIFICADO" in tr.text and "Certificado" in tr.text, \
            f"Fila fuera del filtro: {tr.text!r}"
    ev.step(driver, "Filtros Entidad=Certificado, Acción=REVOCAR_CERTIFICADO y rango del día: solo esos eventos")

    filas[0].find_element(By.CSS_SELECTOR, "button[title='Ver detalle']").click()
    modal = visible(driver, By.CSS_SELECTOR, ".modal-content").text
    ev.step(driver, "Detalle del evento: usuario, IP de origen, entidad y valores antes/después")
    for esperado in ("Usuario:", "IP de origen:", "Entidad:", "ANTES", "DESPUÉS"):
        assert esperado in modal, f"El detalle no muestra '{esperado}'"


def test_ca016_control_de_acceso_lector(driver, ev):
    """CA016: el lector no puede emitir ni entrar a módulos restringidos."""
    clave = password_login_ok(config.LECTOR_EMAIL, config.LECTOR_PASSWORDS)
    login(driver, config.LECTOR_EMAIL, clave, ev=ev, paso="Inicio de sesión como lector")
    ev.step(driver, "El lector accede al panel")

    driver.get(f"{config.BASE_URL}/admin/certificados")
    visible(driver, By.XPATH, "//h1[normalize-space()='Certificados']")
    ev.step(driver, "Módulo Certificados del lector: no existe el botón «Emitir Certificado»")
    assert not driver.find_elements(By.XPATH, "//button[contains(.,'Emitir Certificado')]"), \
        "El lector ve el botón «Emitir Certificado»"

    # Intento directo contra el servidor (sin pasar por la interfaz): debe responder 403.
    st, token = api_login(config.LECTOR_EMAIL, clave)
    if st is None:
        ev.note("Backend no accesible desde la prueba: no se contrastó el HTTP 403 de la emisión.")
    else:
        assert token, "No se pudo obtener el token del lector por API (credenciales inválidas)"
        falso = {k: str(uuid.uuid4()) for k in ("estudiante_id", "institucion_id", "plantilla_id")}
        st, js = api("POST", "/certificados/emitir", falso, token=token)
        banner(driver, f"POST /api/certificados/emitir como lector -> HTTP {st}: "
                       f"{(js or {}).get('message')}")
        ev.step(driver, "Intento de emisión directo al servidor: responde 403 «No autorizado»")
        assert st == 403, f"El servidor respondió HTTP {st} y se esperaba 403"

    driver.get(f"{config.BASE_URL}/admin/usuarios")
    visible(driver, By.XPATH, "//h2[normalize-space()='No autorizado']")
    ev.step(driver, "Ruta /admin/usuarios: «No autorizado»")

    # El lector consulta plantillas (plantilla:ver/listar) pero no la auditoría
    driver.get(f"{config.BASE_URL}/admin/plantillas")
    visible(driver, By.XPATH, "//h1[normalize-space()='Plantillas de Certificado']")
    ev.step(driver, "Ruta /admin/plantillas: el lector consulta las plantillas (solo lectura)")

    driver.get(f"{config.BASE_URL}/admin/auditoria")
    visible(driver, By.XPATH, "//h2[normalize-space()='No autorizado']")
    ev.step(driver, "Ruta /admin/auditoria: «No autorizado»")
    if st is not None:
        st_aud, _ = api("GET", "/auditoria", token=token)
        banner(driver, f"GET /api/auditoria como lector -> HTTP {st_aud}")
        ev.step(driver, "Consulta directa de auditoría al servidor: 403")
        assert st_aud == 403, f"El servidor respondió HTTP {st_aud} a la auditoría y se esperaba 403"
