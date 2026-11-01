/**
 * Métricas CK por módulo (definiciones de la sección 3.1.3 del documento):
 * NOM, WMC (suma de la complejidad ciclomática), DIT, CBO (Ce ∪ Ca, módulos internos)
 * y cohesión TCC. Analiza el árbol sintáctico con @babel/parser.
 *
 *   node ck-metrics.cjs <raíz del repositorio> [--json]
 */
const fs = require('fs')
const path = require('path')
const BABEL = path.resolve(__dirname, '../certivalidate-frontend/node_modules')
const parser = require(require.resolve('@babel/parser', { paths: [process.env.BABEL_DIR || BABEL] }))
const traverse = require(require.resolve('@babel/traverse', { paths: [process.env.BABEL_DIR || BABEL] })).default

const RAIZ = path.resolve(process.argv[2] || '.')
const AMBITO = ['certivalidate-backend/src', 'academic-api/src', 'certivalidate-frontend/src']
const MODULOS = [
  ...['admin', 'auditoria', 'auth', 'blockchain', 'certificado', 'estudiante', 'institucion', 'integracion', 'plantilla', 'roles', 'twoFactor', 'usuario']
    .map((n) => [`certivalidate-backend/src/controllers/${n}.controller.js`, `${n}.controller.js (backend)`]),
  ...fs.readdirSync(path.join(RAIZ, 'certivalidate-backend/src/services')).filter((f) => f.endsWith('.js')).sort()
    .map((f) => [`certivalidate-backend/src/services/${f}`, `${f} (backend)`]),
  ...['certificados', 'cursos', 'estudiantes', 'firmantes', 'plantillas']
    .map((n) => [`academic-api/src/controllers/${n}.controller.js`, `${n}.controller.js (academic-api)`]),
  ['certivalidate-frontend/src/components/ErrorBoundary.jsx', 'ErrorBoundary.jsx (frontend)'],
  ['certivalidate-frontend/src/context/AuthContext.jsx', 'AuthContext.jsx (frontend)'],
].filter(([f]) => fs.existsSync(path.join(RAIZ, f)))

const parse = (file) => parser.parse(fs.readFileSync(file, 'utf8'), {
  sourceType: 'unambiguous', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'], errorRecovery: true,
})

function fuentes(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n)
    if (/node_modules|__tests__|__mocks__/.test(p)) return []
    if (fs.statSync(p).isDirectory()) return fuentes(p)
    return /\.(c?js|jsx|mjs)$/.test(n) && !/\.test\./.test(n) ? [p] : []
  })
}

function resolver(desde, spec) {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(desde), spec)
  for (const c of [base, `${base}.js`, `${base}.jsx`, `${base}.cjs`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.normalize(c)
  }
  return null
}

function importaciones(file) {
  const out = new Set()
  traverse(parse(file), {
    ImportDeclaration(p) { const r = resolver(file, p.node.source.value); if (r) out.add(r) },
    CallExpression(p) {
      const n = p.node
      if (n.callee.name === 'require' && n.arguments[0]?.type === 'StringLiteral') {
        const r = resolver(file, n.arguments[0].value); if (r) out.add(r)
      }
    },
    ExportNamedDeclaration(p) { if (p.node.source) { const r = resolver(file, p.node.source.value); if (r) out.add(r) } },
  })
  out.delete(path.normalize(file))
  return out
}

// Grafo de dependencias internas para el acoplamiento aferente
const todos = AMBITO.flatMap((d) => fuentes(path.join(RAIZ, d)))
const usa = new Map(todos.map((f) => [path.normalize(f), importaciones(f)]))

const DECISION = new Set(['IfStatement', 'ConditionalExpression', 'ForStatement', 'ForInStatement', 'ForOfStatement',
  'WhileStatement', 'DoWhileStatement', 'CatchClause'])

function complejidad(fnPath) {
  let cc = 1
  fnPath.traverse({
    enter(p) {
      if (DECISION.has(p.node.type)) cc++
      else if (p.node.type === 'SwitchCase' && p.node.test) cc++
      else if (p.node.type === 'LogicalExpression' && ['&&', '||', '??'].includes(p.node.operator)) cc++
    },
  })
  return cc
}

function analizar(rel) {
  const file = path.join(RAIZ, rel)
  const ast = parse(file)
  const metodos = []          // { nombre, cc, usa:Set(estado), llama:Set(nombres) }
  const estado = new Set()    // variables de módulo que no son importaciones ni funciones
  let dit = 0

  const esImport = (init) => init && (init.type === 'CallExpression' && init.callee.name === 'require'
    || init.type === 'MemberExpression' && init.object.type === 'CallExpression' && init.object.callee.name === 'require'
    || init.type === 'AwaitExpression')
  const esFuncion = (n) => n && ['ArrowFunctionExpression', 'FunctionExpression'].includes(n.type)

  traverse(ast, {
    Program(p) {
      for (const st of p.get('body')) {
        const decl = st.isExportNamedDeclaration() || st.isExportDefaultDeclaration() ? st.get('declaration') : st
        if (!decl || !decl.node) continue
        if (decl.isVariableDeclaration()) {
          for (const d of decl.get('declarations')) {
            const init = d.node.init
            if (esFuncion(init)) metodos.push({ nombre: d.node.id.name, path: d.get('init') })
            else if (d.node.id.type === 'Identifier' && !esImport(init)) estado.add(d.node.id.name)
          }
        } else if (decl.isFunctionDeclaration() && decl.node.id) {
          metodos.push({ nombre: decl.node.id.name, path: decl })
        } else if (decl.isClassDeclaration() || decl.isClassExpression()) {
          if (decl.node.superClass) dit = 1
          for (const m of decl.get('body.body')) {
            if (m.isClassMethod() || (m.isClassProperty() && esFuncion(m.node.value))) {
              metodos.push({ nombre: m.node.key.name, path: m.isClassMethod() ? m : m.get('value'), clase: true })
            } else if (m.isClassProperty()) {
              estado.add(`this.${m.node.key.name}`)
            }
          }
        }
      }
    },
  })

  const nombres = new Set(metodos.map((m) => m.nombre))
  for (const m of metodos) {
    m.cc = complejidad(m.path)
    m.usa = new Set(); m.llama = new Set()
    m.path.traverse({
      Identifier(p) {
        if (estado.has(p.node.name) && p.isReferencedIdentifier()) m.usa.add(p.node.name)
        if (nombres.has(p.node.name) && p.node.name !== m.nombre && p.isReferencedIdentifier()) m.llama.add(p.node.name)
      },
      MemberExpression(p) {
        if (p.node.object.type === 'ThisExpression' && p.node.property.name) {
          const k = p.node.property.name
          if (nombres.has(k) && k !== m.nombre) m.llama.add(k)
          else m.usa.add(`this.${k}`)
        }
      },
    })
  }

  let pares = 0, conectados = 0
  for (let i = 0; i < metodos.length; i++) {
    for (let j = i + 1; j < metodos.length; j++) {
      pares++
      const a = metodos[i], b = metodos[j]
      if ([...a.usa].some((x) => b.usa.has(x)) || a.llama.has(b.nombre) || b.llama.has(a.nombre)) conectados++
    }
  }
  const norm = path.normalize(file)
  const ce = usa.get(norm) || importaciones(file)
  const ca = new Set([...usa.entries()].filter(([f, deps]) => f !== norm && deps.has(norm)).map(([f]) => f))
  const cbo = new Set([...ce, ...ca]).size
  const ccs = metodos.map((m) => ({ nombre: m.nombre, cc: m.cc }))
  return {
    nom: metodos.length, wmc: ccs.reduce((s, m) => s + m.cc, 0), dit, cbo, ce: ce.size, ca: ca.size,
    tcc: pares ? conectados / pares : 0, metodos: ccs,
  }
}

const filas = MODULOS.map(([rel, nombre]) => ({ modulo: nombre, archivo: rel, ...analizar(rel) }))
if (process.argv.includes('--json')) console.log(JSON.stringify(filas))
else console.table(filas.map(({ metodos, archivo, ...f }) => ({ ...f, tcc: f.tcc.toFixed(2) })))
