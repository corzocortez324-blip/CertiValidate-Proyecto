/**
 * Conteo de líneas de código con Node.js (definición de la sección 3.1.3 del documento):
 * físicas, en blanco, de comentario (// y bloques /* *\/ que empiezan al inicio de la línea)
 * y de código, por componente y por extensión. Alcance: código del producto, sin
 * node_modules, pruebas, migraciones SQL, configuración (JSON/YAML/MD) ni artefactos.
 *
 *   node loc-node.cjs <raíz del repositorio> [--list=lista-archivos.txt] [--json]
 */
const fs = require('fs')
const path = require('path')

const RAIZ = path.resolve(process.argv[2] || '.')
// --list=<archivo>: usa una lista explícita de archivos (la misma que recibe cloc)
const argLista = process.argv.find((a) => a.startsWith('--list='))
const LISTA = argLista ? fs.readFileSync(argLista.slice(7), 'utf8').split(/\r?\n/).filter(Boolean).map((f) => path.resolve(path.dirname(argLista.slice(7)), f)) : null
const EXT = { '.js': 'JavaScript / JSX', '.jsx': 'JavaScript / JSX', '.cjs': 'JavaScript / JSX', '.mjs': 'JavaScript / JSX', '.css': 'CSS', '.sol': 'Solidity' }
const COMPONENTES = {
  'certivalidate-backend': ['src', 'prisma/seed.js'],
  'certivalidate-frontend': ['src'],
  'academic-api': ['src', 'prisma/seed.js'],
  blockchaincontracts: ['.'],
}
const EXCLUIR = /(^|[\\/])(node_modules|tests?|__tests__|__mocks__|migrations|dist|build|coverage|generated)([\\/]|$)/

function archivos(dir) {
  if (!fs.existsSync(dir)) return []
  const st = fs.statSync(dir)
  if (st.isFile()) return EXT[path.extname(dir)] ? [dir] : []
  return fs.readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n)
    if (EXCLUIR.test(path.relative(RAIZ, p))) return []
    if (/\.(test|spec)\.[jt]sx?$/.test(n)) return []
    return archivos(p)
  })
}

function contar(file) {
  const r = { fisicas: 0, blanco: 0, comentario: 0, codigo: 0 }
  let enBloque = false
  for (const linea of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    r.fisicas++
    const t = linea.trim()
    if (enBloque) {
      r.comentario++
      if (t.includes('*/')) enBloque = false
      continue
    }
    if (!t) { r.blanco++; continue }
    if (t.startsWith('//')) { r.comentario++; continue }
    if (t.startsWith('/*')) {
      r.comentario++
      if (!t.includes('*/', 2)) enBloque = true
      continue
    }
    r.codigo++
  }
  // La última línea vacía tras el salto final no es una línea física
  if (fs.readFileSync(file, 'utf8').endsWith('\n')) { r.fisicas--; r.blanco-- }
  return r
}

const total = { archivos: 0, fisicas: 0, blanco: 0, comentario: 0, codigo: 0 }
const porComp = {}
const porLeng = {}
for (const [comp, rutas] of Object.entries(COMPONENTES)) {
  const lista = LISTA
    ? LISTA.filter((f) => path.relative(RAIZ, f).split(path.sep)[0] === comp)
    : [...new Set(rutas.flatMap((r) => archivos(path.join(RAIZ, comp, r))))]
  porComp[comp] = { archivos: lista.length, fisicas: 0, blanco: 0, comentario: 0, codigo: 0 }
  for (const f of lista) {
    const c = contar(f)
    const leng = EXT[path.extname(f)]
    porLeng[leng] = porLeng[leng] || { archivos: 0, codigo: 0 }
    porLeng[leng].archivos++; porLeng[leng].codigo += c.codigo
    for (const k of ['fisicas', 'blanco', 'comentario', 'codigo']) { porComp[comp][k] += c[k]; total[k] += c[k] }
  }
  total.archivos += lista.length
}
const salida = { total, porComp, porLeng }
if (process.argv.includes('--json')) console.log(JSON.stringify(salida))
else {
  console.log('Conteo con Node.js', process.version)
  console.table(porComp)
  console.table(porLeng)
  console.log('TOTAL', total)
}
