/**
 * Reportador de Jest para ejecutar casos del documento en vivo:
 * muestra solo las pruebas ejecutadas (las omitidas por -t no se listan),
 * con su estado y duración, y un resumen final.
 *
 * Uso: npm run test:caso -- <archivo> -t "<ID del caso>"
 */
const OK = process.platform === 'win32' ? '√' : '✓'
const FALLO = process.platform === 'win32' ? '×' : '✕'
const verde = (t) => `\x1b[32m${t}\x1b[39m`
const rojo = (t) => `\x1b[31m${t}\x1b[39m`
const gris = (t) => `\x1b[90m${t}\x1b[39m`
const negrita = (t) => `\x1b[1m${t}\x1b[22m`
const etiqueta = (ok) => (ok ? '\x1b[42m\x1b[30m\x1b[1m PASS \x1b[22m\x1b[39m\x1b[49m' : '\x1b[41m\x1b[37m\x1b[1m FAIL \x1b[22m\x1b[39m\x1b[49m')

class ReporterCasos {
  constructor(globalConfig) {
    this.rootDir = globalConfig.rootDir
  }

  onTestResult(test, resultado) {
    const ejecutadas = resultado.testResults.filter((a) => a.status === 'passed' || a.status === 'failed')
    if (!ejecutadas.length && !resultado.testExecError) return
    const ruta = test.path.replace(this.rootDir, '').replace(/^[\\/]/, '').replace(/\\/g, '/')
    const ok = !resultado.testExecError && ejecutadas.every((a) => a.status === 'passed')
    process.stdout.write(`\n${etiqueta(ok)} ${ruta}\n`)
    for (const a of ejecutadas) {
      const grupo = a.ancestorTitles.length ? gris(`${a.ancestorTitles.join(' › ')} › `) : ''
      const marca = a.status === 'passed' ? verde(OK) : rojo(FALLO)
      process.stdout.write(`    ${marca} ${grupo}${a.title} ${gris(`(${Math.round(a.duration || 0)} ms)`)}\n`)
      if (a.status === 'failed') process.stdout.write(`${rojo(a.failureMessages.join('\n'))}\n`)
    }
    if (resultado.testExecError) process.stdout.write(`${rojo(resultado.testExecError.message)}\n`)
  }

  onRunComplete(_contextos, r) {
    const ejecutadas = r.numPassedTests + r.numFailedTests
    const segundos = ((Date.now() - r.startTime) / 1000).toFixed(1)
    const estado = r.numFailedTests ? rojo(`${r.numFailedTests} fallida(s)`) : verde(`${r.numPassedTests} aprobada(s)`)
    process.stdout.write(`\n${negrita('Pruebas ejecutadas:')} ${estado} de ${ejecutadas}\n`)
    process.stdout.write(`${negrita('Tiempo:')}             ${segundos} s\n`)
    process.stdout.write(gris(`Ejecutado el ${new Date().toLocaleString('es-CO')}\n`))
  }
}

module.exports = ReporterCasos
