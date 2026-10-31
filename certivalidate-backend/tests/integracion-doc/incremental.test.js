/**
 * Integración incremental (apartado 2.4.1): ascendente (CI-A01…A12), descendente
 * por profundidad (CI-DP1…DP8) y por anchura (CI-DA1…DA4). Cada caso ejecuta,
 * en orden, los pasos de su tabla de diseño. Los pasos de interfaz web se
 * ejecutan en certivalidate-frontend/src/__tests__/integracion/incremental.test.jsx.
 */
const { crearEscenario, crearApiAcademica } = require('./escenario')
const { PASOS } = require('./pasos')
const { cleanupTestData } = require('../helpers/db')

const FRONTEND = new Set(['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'CP-P1', 'SIS-CP',
  'P1-P2', 'P1-P3', 'P1-P4', 'P1-P5', 'P1-P6', 'P1-P7', 'P1-P8'])

const CASOS = {
  'CI-A01': ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
  'CI-A02': ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'],
  'CI-A03': ['T1', 'T2', 'T3', 'T4', 'T5'],
  'CI-A04': ['D2'],
  'CI-A05': ['E1', 'E2'],
  'CI-A06': ['P1-P2', 'P1-P3', 'P1-P4', 'P1-P5', 'P1-P6', 'P1-P7', 'P1-P8'],
  'CI-A07': ['SN-N1', 'SN-N2', 'SN-N3', 'SN-N4', 'SN-N5', 'SN-N6', 'SN-N7'],
  'CI-A08': ['ST-T1', 'ST-T2', 'ST-T3', 'ST-T4', 'ST-T5'],
  'CI-A09': ['D1-D2'],
  'CI-A10': ['CE-E1', 'CE-E2'],
  'CI-A11': ['CP-P1', 'G1-SN', 'G1-ST', 'CS-G1', 'CD-D1'],
  'CI-A12': ['SIS-CP', 'SIS-CS', 'SIS-CD', 'SIS-CE'],
  'CI-DP1': ['SIS-CP', 'CP-P1', 'P1-P2'],
  'CI-DP2': ['P1-P3', 'P1-P4', 'P1-P5', 'P1-P6', 'P1-P7', 'P1-P8'],
  'CI-DP3': ['SIS-CS', 'CS-G1', 'G1-SN', 'SN-N1'],
  'CI-DP4': ['SN-N2', 'SN-N3', 'SN-N4', 'SN-N5', 'SN-N6', 'SN-N7'],
  'CI-DP5': ['G1-ST', 'ST-T1'],
  'CI-DP6': ['ST-T2', 'ST-T3', 'ST-T4', 'ST-T5'],
  'CI-DP7': ['SIS-CD', 'CD-D1', 'D1-D2'],
  'CI-DP8': ['SIS-CE', 'CE-E1', 'CE-E2'],
  'CI-DA1': ['SIS-CP', 'SIS-CS', 'SIS-CD', 'SIS-CE'],
  'CI-DA2': ['CP-P1', 'CS-G1', 'CD-D1', 'CE-E1', 'CE-E2'],
  'CI-DA3': ['P1-P2', 'P1-P3', 'P1-P4', 'P1-P5', 'P1-P6', 'P1-P7', 'P1-P8', 'G1-SN', 'G1-ST', 'D1-D2'],
  'CI-DA4': ['SN-N1', 'SN-N2', 'SN-N3', 'SN-N4', 'SN-N5', 'SN-N6', 'SN-N7', 'ST-T1', 'ST-T2', 'ST-T3', 'ST-T4', 'ST-T5'],
}

let api

beforeAll(async () => { api = await crearApiAcademica() })
afterAll(async () => { await api.cerrar(); await cleanupTestData() })

for (const [caso, pasos] of Object.entries(CASOS)) {
  const backend = pasos.filter((p) => !FRONTEND.has(p))
  if (backend.length === 0) continue // caso solo de interfaz web (ver frontend)

  describe(caso, () => {
    let ctx
    // Cada caso tiene su propio escenario: la integración configurada en un caso no afecta a otro
    beforeAll(async () => { ctx = await crearEscenario(`${caso.replace(/\W/g, '')}_${Date.now()}`) })
    beforeEach(() => api.reiniciar())

    for (const paso of backend) {
      it(`${caso} · ${paso}`, async () => {
        expect.hasAssertions() // cada paso verifica su salida esperada con expect
        // y el paso completo debe terminar sin fallar
        await expect(Promise.resolve(PASOS[paso](ctx, api)).then(() => true)).resolves.toBe(true)
      }, 45000)
    }
  })
}
