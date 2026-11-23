/**
 * Ejecuta cloc (paquete npm, escrito en Perl) sobre la lista de archivos de la medición.
 *
 * En Windows, cloc necesita un intérprete de Perl en el PATH. Si no lo hay, se usa el
 * Perl que trae Git for Windows (C:\Program Files\Git\usr\bin), para que la medición
 * no falle con «"perl" no se reconoce como un comando interno o externo».
 *
 *   node cloc.cjs [argumentos de cloc]
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const env = { ...process.env }
const tienePerl = spawnSync('perl', ['-v'], { env, shell: true }).status === 0
if (!tienePerl && process.platform === 'win32') {
  const candidatos = [
    'C:\\Program Files\\Git\\usr\\bin',
    'C:\\Program Files (x86)\\Git\\usr\\bin',
  ]
  const dir = candidatos.find((d) => fs.existsSync(path.join(d, 'perl.exe')))
  if (!dir) {
    console.error('No se encontró Perl. Instale Git for Windows o Strawberry Perl.')
    process.exit(1)
  }
  env.PATH = `${dir};${env.PATH}`
}

const script = path.join(__dirname, 'node_modules', 'cloc', 'lib', 'cloc')
const r = spawnSync('perl', [script, ...process.argv.slice(2)], { env, stdio: 'inherit' })
process.exit(r.status ?? 1)
