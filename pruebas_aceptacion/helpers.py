"""Utilidades compartidas por las pruebas."""
import json
import pathlib
import re
import shutil
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

import config


# ───────────── esperas y localizadores ─────────────
def wait(driver, timeout=None):
    # Las tablas se re-renderizan al llegar datos: un elemento obsoleto se reintenta.
    return WebDriverWait(driver, timeout or config.TIMEOUT,
                         ignored_exceptions=(StaleElementReferenceException,))


def visible(driver, by, selector, timeout=None):
    return wait(driver, timeout).until(EC.visibility_of_element_located((by, selector)))


def clickable(driver, by, selector, timeout=None):
    return wait(driver, timeout).until(EC.element_to_be_clickable((by, selector)))


def button(driver, text, scope=None, timeout=None):
    """Botón (visible y habilitado) cuyo texto contiene `text`."""
    xp = f".//button[contains(normalize-space(.), '{text}')]"
    root = scope or driver
    return wait(driver, timeout).until(
        lambda d: next((b for b in root.find_elements(By.XPATH, xp)
                        if b.is_displayed() and b.is_enabled()), False)
    )


def field_by_label(scope, label, tag="input"):
    """Primer <input>/<select>/<textarea> que sigue a un <label> que empieza por `label`."""
    return scope.find_element(
        By.XPATH, f".//label[starts-with(normalize-space(.), '{label}')]/following::{tag}[1]"
    )


def select_contains(driver, select_el, text):
    """Elige la opción cuyo texto contiene `text` (espera a que las opciones carguen)."""
    def _find(_):
        for o in Select(select_el).options:
            if text.lower() in o.text.lower():
                return o.text
        return False
    try:
        chosen = wait(driver).until(_find)
    except Exception:
        opciones = [o.text for o in Select(select_el).options]
        raise AssertionError(f"No existe la opción '{text}'. Opciones: {opciones}")
    Select(select_el).select_by_visible_text(chosen)


def set_input_value(driver, element, value):
    """Asigna valor a un input de React disparando el evento 'input' (sirve para type=date)."""
    driver.execute_script(
        """
        const el = arguments[0], v = arguments[1];
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        """,
        element, value,
    )


def wait_modal_closed(driver, timeout=None):
    """Espera a que se cierre el modal; si aparece un error dentro del modal, falla con su texto."""
    def _check(d):
        if not d.find_elements(By.CSS_SELECTOR, ".modal-overlay"):
            return True
        for e in d.find_elements(By.CSS_SELECTOR, ".modal-content .alert-error"):
            # El modal de revocación muestra un aviso fijo con el mismo estilo; no es un error.
            if e.is_displayed() and e.text.strip() and not e.text.strip().startswith("⚠"):
                raise AssertionError(f"El formulario devolvió un error: {e.text.strip()}")
        return False
    wait(driver, timeout).until(_check)


def visible_errors(driver):
    return [e.text.strip() for e in driver.find_elements(By.CSS_SELECTOR, ".alert-error")
            if e.is_displayed() and e.text.strip()]


# ───────────── evidencias ─────────────
STEPS = {}   # caso -> [{n, texto, archivo}]
NOTES = {}   # caso -> [observaciones técnicas]


def save_shot(driver, name):
    folder = pathlib.Path(config.EVIDENCE_DIR)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{name}.png"
    driver.save_screenshot(str(path))
    return str(path)


def _slug(texto):
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "_", t).strip("_").lower()[:50] or "paso"


class Evidence:
    """Captura numerada por paso: evidencias/CA007/01_formulario_completo.png ..."""

    def __init__(self, caso):
        self.caso = caso
        self.folder = pathlib.Path(config.EVIDENCE_DIR) / caso
        if caso not in STEPS:  # primera vez en esta ejecución: limpia capturas viejas
            if self.folder.exists():
                for f in self.folder.iterdir():
                    if f.is_file() and not f.name.startswith("manual_"):
                        f.unlink()
            STEPS[caso], NOTES[caso] = [], []
        self.folder.mkdir(parents=True, exist_ok=True)

    def _next(self, texto, ext="png"):
        n = len(STEPS[self.caso]) + 1
        return n, self.folder / f"{n:02d}_{_slug(texto)}.{ext}"

    def step(self, driver, texto, pausa=0.5):
        """Registra un paso verificado y guarda su pantallazo."""
        time.sleep(pausa)
        n, path = self._next(texto)
        driver.save_screenshot(str(path))
        STEPS[self.caso].append({"n": n, "texto": texto, "archivo": str(path)})

    def image(self, origen, texto):
        """Registra como paso una imagen que ya existe (p. ej. el PDF descargado)."""
        n, path = self._next(texto)
        shutil.copy(origen, path)
        STEPS[self.caso].append({"n": n, "texto": texto, "archivo": str(path)})

    def note(self, texto):
        """Observación técnica/funcional (el caso queda «Aprobado con observaciones»)."""
        NOTES[self.caso].append(texto)


def banner(driver, texto):
    """Superpone un mensaje (p. ej. un alert() ya aceptado o una respuesta HTTP) para poder fotografiarlo."""
    driver.execute_script(
        """
        const d = document.createElement('div');
        d.textContent = arguments[0];
        d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
          'background:#111827;color:#fff;font:14px/1.4 monospace;padding:10px 16px;' +
          'border-bottom:3px solid #00cdd8;white-space:pre-wrap';
        document.body.appendChild(d);
        """, texto)


# ───────────── API del backend (solo comprobaciones de apoyo) ─────────────
def api(method, path, body=None, token=None, timeout=10):
    """Llama al backend. Devuelve (status, json) o (None, None) si no está accesible."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{config.BACKEND_URL}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {}
    except Exception:
        return None, None


def api_login(email, password):
    """(status, token|None). status None = backend inaccesible."""
    st, js = api("POST", "/auth/login", {"email": email, "password": password})
    token = ((js or {}).get("data") or {}).get("token")
    return st, token


# ───────────── flujos reutilizables ─────────────
def login(driver, email, password, esperar="/admin", ev=None, paso="Inicio de sesión"):
    """Inicia sesión por la interfaz. `esperar`: fragmento de URL esperado (None = cualquier salida de /login)."""
    driver.get(f"{config.BASE_URL}/login")
    visible(driver, By.CSS_SELECTOR, "input[type='email']").send_keys(email)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(password)
    if ev:
        ev.step(driver, f"{paso}: pantalla /login con las credenciales ingresadas")
    driver.find_element(By.CSS_SELECTOR, "button.auth-submit").click()
    if esperar is False:
        return

    def _listo(d):
        if esperar and esperar in d.current_url:
            return True
        if not esperar and not d.current_url.rstrip("/").endswith("/login"):
            return True
        errs = visible_errors(d)
        if errs:
            raise AssertionError(f"El inicio de sesión falló: {errs[0]}")
        return False

    wait(driver).until(_listo)


def password_login_ok(email, passwords):
    """Devuelve la primera contraseña aceptada por el backend (o la primera si no hay backend)."""
    for p in passwords:
        st, token = api_login(email, p)
        if st is None:
            return passwords[0]
        if token:
            return p
    return passwords[0]


def list_certs(driver, query, match=None):
    """Abre Certificados, filtra por `query` y devuelve las filas visibles."""
    driver.get(f"{config.BASE_URL}/admin/certificados")
    box = visible(driver, By.CSS_SELECTOR, "input.search-input")
    # Se espera la carga inicial (sin filtro): si su respuesta llega después de la filtrada,
    # la página la muestra igual y sobrescribe el resultado de la búsqueda.
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, "table.data-table tbody tr td")
                       and not d.find_elements(By.XPATH, "//td[normalize-space()='Cargando...']"))
    time.sleep(1)
    box.clear()
    box.send_keys(query)  # escritura real: dispara onChange de React de forma fiable
    time.sleep(1.5)  # debounce de la búsqueda
    wait(driver).until(lambda d: not d.find_elements(
        By.XPATH, "//td[normalize-space()='Cargando...']"))

    def _leer():
        rows = []
        for tr in driver.find_elements(By.CSS_SELECTOR, "table.data-table tbody tr"):
            tds = tr.find_elements(By.TAG_NAME, "td")
            if len(tds) < 7:
                continue
            rows.append({
                "codigo": tds[0].text.strip(),
                "estudiante": " ".join(tds[1].text.split()),
                "plantilla": tds[3].text.strip(),
                "estado": tds[6].text.strip(),
            })
        return rows

    # La tabla se vuelve a renderizar cuando llega la respuesta filtrada: se reintenta
    # si una fila desaparece mientras se lee, y se espera a que el resultado se estabilice.
    # Solo se acepta un resultado ya filtrado: todas las filas coinciden con `query`, o la tabla
    # informa «No se encontraron».
    q = " ".join(query.split()).lower()

    def _filtrado(rows):
        if rows:
            if match:
                return all(match(r) for r in rows)
            return all(q in r["codigo"].lower() or q in r["estudiante"].lower() for r in rows)
        return bool(driver.find_elements(By.XPATH, "//td[contains(., 'No se encontraron')]"))

    previo = None
    for _ in range(20):
        try:
            rows = _leer()
            listo = _filtrado(rows)
        except StaleElementReferenceException:
            time.sleep(0.5)
            continue
        if listo and rows == previo:
            return rows
        previo = rows if listo else None
        time.sleep(0.7)
    raise AssertionError(f"El listado de certificados no se estabilizó al filtrar por {query!r}")


def row_for(driver, codigo):
    return driver.find_element(By.XPATH, f"//tr[td[normalize-space()='{codigo}']]")


def emitir(driver, institucion, documento, plantilla, ev=None):
    """Completa el modal «Emitir Certificado» y confirma. No espera el resultado."""
    driver.get(f"{config.BASE_URL}/admin/certificados")
    button(driver, "Emitir Certificado").click()
    modal = visible(driver, By.CSS_SELECTOR, ".modal-content")
    select_contains(driver, field_by_label(modal, "Institución", "select"), institucion)
    est = field_by_label(modal, "Estudiante")
    wait(driver).until(lambda d: est.is_enabled())
    est.send_keys(documento)
    clickable(driver, By.CSS_SELECTOR, "li.autocomplete-item").click()
    select_contains(driver, field_by_label(modal, "Plantilla", "select"), plantilla)
    if ev:
        ev.step(driver, "Modal «Emitir Certificado» con institución, estudiante y plantilla seleccionados")
    button(driver, "Previsualizar y emitir", scope=modal).click()
    visible(driver, By.CSS_SELECTOR, ".pcm-dialog")
    wait(driver).until(lambda d: not d.find_elements(By.CSS_SELECTOR, ".pcm-skeleton"))
    if ev:
        ev.step(driver, "Previsualización del certificado antes de confirmar la emisión")
    button(driver, "Confirmar emisión").click()


def public_verify(driver, codigo, ev=None):
    """Portal público: ingresa el código y devuelve el contenedor del resultado."""
    driver.get(f"{config.BASE_URL}/")
    box = visible(driver, By.CSS_SELECTOR, "input.verify-input")
    box.send_keys(codigo)
    if ev:
        ev.step(driver, "Portal público (sin sesión) con el código ingresado")
    driver.find_element(By.CSS_SELECTOR, "button.btn-verify").click()
    return visible(driver, By.CSS_SELECTOR, ".result-card")


# ───────────── MailHog (opcional) ─────────────
def resend_api(path, timeout=15):
    """GET a la API de Resend con la clave del backend. Devuelve (status, json)."""
    req = urllib.request.Request(f"https://api.resend.com{path}", method="GET")
    req.add_header("Authorization", f"Bearer {config.RESEND_API_KEY}")
    req.add_header("User-Agent", "certivalidate-pruebas-aceptacion")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {}


def resend_entrega(destinatario, desde, timeout=90):
    """Busca en Resend el correo más reciente a `destinatario` creado desde `desde`
    (UTC, ISO) y espera a que su último evento sea «delivered». Devuelve el correo."""
    limite = time.time() + timeout
    correo = None
    while time.time() < limite:
        if correo is None:
            st, js = resend_api("/emails?limit=20")
            assert st == 200, f"La API de Resend respondió HTTP {st} al listar correos: {js}"
            correo = next((e for e in (js or {}).get("data", [])  # la lista viene del más reciente al más antiguo
                           if destinatario in (e.get("to") or [])
                           and e.get("created_at", "").replace(" ", "T")[:19] >= desde), None)
        if correo is not None:
            st, js = resend_api(f"/emails/{correo['id']}")
            if st == 200 and js.get("last_event") == "delivered":
                return js
            if st == 200 and js.get("last_event") in ("bounced", "failed", "complained"):
                raise AssertionError(f"Resend reporta el correo como {js.get('last_event')}")
        time.sleep(3)
    raise AssertionError(f"Resend no confirmó la entrega del correo a {destinatario} en {timeout} s")


def mailhog_find(to, timeout=30):
    if not config.MAILHOG_URL:
        return None
    url = f"{config.MAILHOG_URL}/api/v2/search?kind=to&query={urllib.parse.quote(to)}"
    fin = time.time() + timeout
    while time.time() < fin:
        with urllib.request.urlopen(url, timeout=10) as r:
            items = json.load(r).get("items", [])
        if items:
            return items
        time.sleep(2)
    return []


def mail_body(item):
    import quopri
    raw = item["Content"]["Body"].encode("utf-8", "ignore")
    return quopri.decodestring(raw).decode("utf-8", "ignore")


def extract_verify_link(body):
    m = re.search(r"https?://[^\s\"'<>]*verificar-email\?token=[A-Za-z0-9._\-%]+", body)
    return m.group(0) if m else None


def db_verification_token(email):
    """Lee el token de verificación de la BD (requiere DATABASE_URL y psycopg o psycopg2)."""
    if not config.DATABASE_URL:
        return None
    try:
        import psycopg as pg
    except ImportError:
        try:
            import psycopg2 as pg
        except ImportError:
            return None
    with pg.connect(config.DATABASE_URL) as conn, conn.cursor() as cur:
        cur.execute('SELECT token_verificacion FROM "Usuario" WHERE email = %s', (email.lower(),))
        fila = cur.fetchone()
    return fila[0] if fila and fila[0] else None
