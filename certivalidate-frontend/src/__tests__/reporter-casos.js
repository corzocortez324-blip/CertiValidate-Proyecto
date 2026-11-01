/**
 * Reportador de Vitest para ejecutar casos del documento en vivo:
 * muestra solo las pruebas ejecutadas (las omitidas por -t no se listan),
 * con su estado y duración, y un resumen final.
 *
 * Uso: npm run test:caso -- <archivo> -t "<ID del caso>"
 */
import path from 'node:path'

const OK = process.platform === 'win32' ? '√' : '✓'
const FALLO = process.platform === 'win32' ? '×' : '✕'
const verde = (t) => `\x1b[32m${t}\x1b[39m`
const rojo = (t) => `\x1b[31m${t}\x1b[39m`
const gris = (t) => `\x1b[90m${t}\x1b[39m`
const negrita = (t) => `\x1b[1m${t}\x1b[22m`
const etiqueta = (ok) => (ok ? '\x1b[42m\x1b[30m\x1b[1m PASS \x1b[22m\x1b[39m\x1b[49m' : '\x1b[41m\x1b[37m\x1b[1m FAIL \x1b[22m\x1b[39m\x1b[49m')

const pruebasDe = (tarea, grupos = []) =>
  (tarea.tasks || []).flatMap((t) =>
    t.type === 'suite' ? pruebasDe(t, [...grupos, t.name]) : [{ ...t, grupos }],
  )

export default class ReporterCasos {
  onInit(ctx) {
    this.ctx = ctx
    this.inicio = Date.now()
  }

  onFinished(archivos = []) {
    let aprobadas = 0
    let fallidas = 0
    for (const archivo of archivos) {
      const ejecutadas = pruebasDe(archivo).filter((p) => p.result?.state === 'pass' || p.result?.state === 'fail')
      if (!ejecutadas.length && !archivo.result?.errors?.length) continue
      const ok = ejecutadas.every((p) => p.result.state === 'pass') && !archivo.result?.errors?.length
      const ruta = path.relative(this.ctx.config.root, archivo.filepath).replace(/\\/g, '/')
      process.stdout.write(`\n${etiqueta(ok)} ${ruta}\n`)
      for (const p of ejecutadas) {
        const pasa = p.result.state === 'pass'
        if (pasa) aprobadas += 1
        else fallidas += 1
        const grupo = p.grupos.length ? gris(`${p.grupos.join(' › ')} › `) : ''
        process.stdout.write(`    ${pasa ? verde(OK) : rojo(FALLO)} ${grupo}${p.name} ${gris(`(${Math.round(p.result.duration || 0)} ms)`)}\n`)
        if (!pasa) process.stdout.write(`${rojo((p.result.errors || []).map((e) => e.message).join('\n'))}\n`)
      }
      for (const e of archivo.result?.errors || []) process.stdout.write(`${rojo(e.message)}\n`)
    }
    const estado = fallidas ? rojo(`${fallidas} fallida(s)`) : verde(`${aprobadas} aprobada(s)`)
    process.stdout.write(`\n${negrita('Pruebas ejecutadas:')} ${estado} de ${aprobadas + fallidas}\n`)
    process.stdout.write(`${negrita('Tiempo:')}             ${((Date.now() - this.inicio) / 1000).toFixed(1)} s\n`)
    process.stdout.write(gris(`Ejecutado el ${new Date().toLocaleString('es-CO')}\n`))
  }
}
