import csv
import datetime
import json
import pathlib
import re

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

import config
from helpers import NOTES, STEPS, Evidence, login

RESULTS = []
DOWNLOADS = pathlib.Path(config.EVIDENCE_DIR).resolve() / "descargas"


def make_driver():
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    opts = Options()
    if config.HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1440,900")
    opts.add_argument("--lang=es-CO")
    opts.add_experimental_option("prefs", {
        "download.default_directory": str(DOWNLOADS),
        "download.prompt_for_download": False,
        "profile.default_content_setting_values.automatic_downloads": 1,
    })
    return webdriver.Chrome(options=opts)  # Selenium Manager descarga el driver


@pytest.fixture
def driver():
    """Navegador limpio por prueba (sin sesión)."""
    drv = make_driver()
    yield drv
    drv.quit()


@pytest.fixture(scope="session")
def admin():
    """Navegador ya autenticado como administrador, compartido por las pruebas de gestión.

    El backend limita login/registro a 10 peticiones por IP+correo cada 15 min
    (limiterAuth en app.js). Iniciar sesión una vez evita agotar ese límite.
    """
    drv = make_driver()
    try:
        login(drv, config.ADMIN_EMAIL, config.ADMIN_PASSWORD)
    except Exception:
        drv.quit()
        raise
    yield drv
    drv.quit()


@pytest.fixture
def downloads_dir():
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    return DOWNLOADS


@pytest.fixture(scope="session")
def state():
    """Datos que una prueba deja para las siguientes (código del certificado, etc.)."""
    return {}


@pytest.fixture
def ev(request):
    m = re.search(r"ca(\d{3})", request.node.name)
    return Evidence(f"CA{m.group(1)}" if m else request.node.name)


def need(state, key):
    if key not in state:
        pytest.skip(f"Depende de una prueba previa que no dejó '{key}' (falló u fue omitida)")
    return state[key]


def pytest_collection_modifyitems(items):
    """Orden lógico: CA011 (revocar) después de CA012/CA013; CA002 (bloqueo) al final."""
    prio = {11: 13.5, 2: 99.0}

    def key(item):
        m = re.search(r"ca(\d{3})", item.name)
        n = int(m.group(1)) if m else 0
        return prio.get(n, float(n))

    items.sort(key=key)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if rep.when != "call":
        return
    drv = item.funcargs.get("driver") or item.funcargs.get("admin")
    m = re.search(r"ca(\d{3})", item.name)
    caso = f"CA{m.group(1)}" if m else item.name
    if rep.passed:
        res, detalle = "Aprobado", ""
    elif rep.skipped:
        res = "Omitido"
        detalle = str(call.excinfo.value) if call.excinfo else ""
    else:
        res = "No aprobado"
        detalle = str(call.excinfo.value).strip().splitlines()[0][:400] if call.excinfo else ""
    shot = ""
    if drv and not rep.skipped:
        try:
            folder = pathlib.Path(config.EVIDENCE_DIR) / caso
            folder.mkdir(parents=True, exist_ok=True)
            etiqueta = "FINAL" if rep.passed else "FALLO"
            shot = str(folder / f"99_{item.name}_{etiqueta}.png")
            drv.save_screenshot(shot)
        except Exception:
            shot = ""
    RESULTS.append({"caso": caso, "prueba": item.name, "resultado": res,
                    "detalle": detalle, "captura": shot})


def _consolidar():
    """Un registro por caso (CA004 tiene dos pruebas)."""
    por_caso = {}
    for r in RESULTS:
        por_caso.setdefault(r["caso"], []).append(r)
    casos = {}
    for caso, filas in sorted(por_caso.items()):
        estados = {f["resultado"] for f in filas}
        if "No aprobado" in estados:
            res = "No aprobado"
        elif estados == {"Omitido"}:
            res = "Omitido"
        elif "Omitido" in estados:
            res = "Parcial"
        else:
            res = "Aprobado"
        pasos = list(STEPS.get(caso, []))
        extra = [f["captura"] for f in filas if f["captura"]]
        manuales = sorted(str(p) for p in (pathlib.Path(config.EVIDENCE_DIR) / caso).glob("manual_*"))
        casos[caso] = {
            "resultado": res,
            "pruebas": [f["prueba"] for f in filas],
            "detalle": " | ".join(f["detalle"] for f in filas if f["detalle"]),
            "pasos": pasos,
            "observaciones": list(NOTES.get(caso, [])),
            "captura_final": extra,
            "manuales": manuales,
        }
    return casos


def pytest_sessionfinish(session, exitstatus):
    if not RESULTS:
        return
    folder = pathlib.Path(config.EVIDENCE_DIR)
    folder.mkdir(parents=True, exist_ok=True)
    with open(folder / "resultados.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["caso", "prueba", "resultado", "detalle", "captura"])
        w.writeheader()
        w.writerows(sorted(RESULTS, key=lambda r: r["caso"]))
    # Mezcla con ejecuciones parciales anteriores (p. ej. `pytest -k ca007`)
    ruta = folder / "resultados.json"
    previo = {}
    if ruta.exists():
        try:
            previo = json.loads(ruta.read_text(encoding="utf-8")).get("casos", {})
        except Exception:
            previo = {}
    previo.update(_consolidar())
    ruta.write_text(json.dumps({
        "generado": datetime.datetime.now().isoformat(timespec="seconds"),
        "casos": previo,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
