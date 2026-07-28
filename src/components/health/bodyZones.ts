/**
 * Zonas del mapa corporal.
 *
 * Las coordenadas están medidas sobre las ilustraciones de `public/body/`
 * (frente y dorso, 298x593 px) y expresadas en un espacio de 100 x 199 por vista,
 * que respeta el aspecto del dibujo. Referencias sacadas de la silueta real:
 *
 *   cabeza 0-30 · cuello 28-36 · hombros 34-58 · torso 40-95 · cadera 92-110
 *   muslo 110-143 · rodilla 143-153 · pierna 153-190 · tobillo 188-196 · pie 194-199
 *   pierna izquierda x 30-48 · pierna derecha x 52-70 · brazos x 5-27 y 73-95
 *
 * Izquierda y derecha son las del espectador, que es como se lee un mapa corporal.
 */

export const VIEW_W = 100
export const VIEW_H = 199

export type BodyView = 'front' | 'back'

export interface BodyZone {
  id: string
  name: string
  view: BodyView
  /** Rectángulo de la zona: x, y, ancho, alto. */
  x: number
  y: number
  w: number
  h: number
}

export const BODY_ZONES: BodyZone[] = [
  // ── FRENTE ────────────────────────────────────────────────────────────────
  { id: 'cabeza',         name: 'Cabeza',                 view: 'front', x: 38, y: 2,   w: 24, h: 28 },
  { id: 'cuello',         name: 'Cuello',                 view: 'front', x: 43, y: 28,  w: 14, h: 9 },
  { id: 'hombro_izq',     name: 'Hombro izquierdo',       view: 'front', x: 14, y: 35,  w: 19, h: 24 },
  { id: 'hombro_der',     name: 'Hombro derecho',         view: 'front', x: 67, y: 35,  w: 19, h: 24 },
  { id: 'pectoral_izq',   name: 'Pectoral izquierdo',     view: 'front', x: 33, y: 41,  w: 17, h: 25 },
  { id: 'pectoral_der',   name: 'Pectoral derecho',       view: 'front', x: 50, y: 41,  w: 17, h: 25 },
  { id: 'biceps_izq',     name: 'Bíceps izquierdo',       view: 'front', x: 12, y: 59,  w: 15, h: 25 },
  { id: 'biceps_der',     name: 'Bíceps derecho',         view: 'front', x: 73, y: 59,  w: 15, h: 25 },
  { id: 'antebrazo_izq',  name: 'Antebrazo izquierdo',    view: 'front', x: 5,  y: 84,  w: 15, h: 21 },
  { id: 'antebrazo_der',  name: 'Antebrazo derecho',      view: 'front', x: 80, y: 84,  w: 15, h: 21 },
  { id: 'abdomen',        name: 'Abdomen',                view: 'front', x: 39, y: 66,  w: 22, h: 27 },
  { id: 'oblicuo_izq',    name: 'Oblicuo izquierdo',      view: 'front', x: 30, y: 66,  w: 9,  h: 29 },
  { id: 'oblicuo_der',    name: 'Oblicuo derecho',        view: 'front', x: 61, y: 66,  w: 9,  h: 29 },
  { id: 'aductor_izq',    name: 'Aductor izquierdo',      view: 'front', x: 40, y: 95,  w: 9,  h: 22 },
  { id: 'aductor_der',    name: 'Aductor derecho',        view: 'front', x: 51, y: 95,  w: 9,  h: 22 },
  { id: 'cadera_izq',     name: 'Cadera izquierda',       view: 'front', x: 30, y: 93,  w: 11, h: 18 },
  { id: 'cadera_der',     name: 'Cadera derecha',         view: 'front', x: 59, y: 93,  w: 11, h: 18 },
  { id: 'cuadriceps_izq', name: 'Cuádriceps izquierdo',   view: 'front', x: 31, y: 112, w: 16, h: 31 },
  { id: 'cuadriceps_der', name: 'Cuádriceps derecho',     view: 'front', x: 53, y: 112, w: 16, h: 31 },
  { id: 'rodilla_izq',    name: 'Rodilla izquierda',      view: 'front', x: 31, y: 143, w: 14, h: 11 },
  { id: 'rodilla_der',    name: 'Rodilla derecha',        view: 'front', x: 55, y: 143, w: 14, h: 11 },
  { id: 'tibia_izq',      name: 'Tibia izquierda',        view: 'front', x: 31, y: 154, w: 13, h: 34 },
  { id: 'tibia_der',      name: 'Tibia derecha',          view: 'front', x: 56, y: 154, w: 13, h: 34 },
  { id: 'tobillo_izq',    name: 'Tobillo izquierdo',      view: 'front', x: 32, y: 187, w: 11, h: 8 },
  { id: 'tobillo_der',    name: 'Tobillo derecho',        view: 'front', x: 57, y: 187, w: 11, h: 8 },
  { id: 'pie_izq',        name: 'Pie izquierdo',          view: 'front', x: 33, y: 193, w: 10, h: 6 },
  { id: 'pie_der',        name: 'Pie derecho',            view: 'front', x: 58, y: 193, w: 10, h: 6 },

  // ── DORSO ─────────────────────────────────────────────────────────────────
  { id: 'nuca',           name: 'Nuca',                   view: 'back',  x: 43, y: 28,  w: 14, h: 9 },
  { id: 'trapecio',       name: 'Trapecio',               view: 'back',  x: 33, y: 34,  w: 34, h: 14 },
  { id: 'deltoides_izq',  name: 'Deltoides izquierdo',    view: 'back',  x: 14, y: 35,  w: 19, h: 24 },
  { id: 'deltoides_der',  name: 'Deltoides derecho',      view: 'back',  x: 67, y: 35,  w: 19, h: 24 },
  { id: 'triceps_izq',    name: 'Tríceps izquierdo',      view: 'back',  x: 12, y: 59,  w: 15, h: 25 },
  { id: 'triceps_der',    name: 'Tríceps derecho',        view: 'back',  x: 73, y: 59,  w: 15, h: 25 },
  { id: 'antebrazo_izq',  name: 'Antebrazo izquierdo',    view: 'back',  x: 5,  y: 84,  w: 15, h: 21 },
  { id: 'antebrazo_der',  name: 'Antebrazo derecho',      view: 'back',  x: 80, y: 84,  w: 15, h: 21 },
  { id: 'dorsal_izq',     name: 'Dorsal izquierdo',       view: 'back',  x: 31, y: 48,  w: 18, h: 29 },
  { id: 'dorsal_der',     name: 'Dorsal derecho',         view: 'back',  x: 51, y: 48,  w: 18, h: 29 },
  { id: 'lumbar',         name: 'Zona lumbar',            view: 'back',  x: 37, y: 77,  w: 26, h: 20 },
  { id: 'gluteo_izq',     name: 'Glúteo izquierdo',       view: 'back',  x: 30, y: 95,  w: 19, h: 20 },
  { id: 'gluteo_der',     name: 'Glúteo derecho',         view: 'back',  x: 51, y: 95,  w: 19, h: 20 },
  { id: 'isquio_izq',     name: 'Isquiotibial izquierdo', view: 'back',  x: 31, y: 115, w: 16, h: 30 },
  { id: 'isquio_der',     name: 'Isquiotibial derecho',   view: 'back',  x: 53, y: 115, w: 16, h: 30 },
  { id: 'rodilla_izq',    name: 'Rodilla izquierda',      view: 'back',  x: 31, y: 145, w: 14, h: 10 },
  { id: 'rodilla_der',    name: 'Rodilla derecha',        view: 'back',  x: 55, y: 145, w: 14, h: 10 },
  { id: 'gemelo_izq',     name: 'Gemelo izquierdo',       view: 'back',  x: 31, y: 155, w: 13, h: 28 },
  { id: 'gemelo_der',     name: 'Gemelo derecho',         view: 'back',  x: 56, y: 155, w: 13, h: 28 },
  { id: 'aquiles_izq',    name: 'Tendón de Aquiles izq.', view: 'back',  x: 32, y: 183, w: 11, h: 12 },
  { id: 'aquiles_der',    name: 'Tendón de Aquiles der.', view: 'back',  x: 57, y: 183, w: 11, h: 12 },
]

/**
 * Grupos bilaterales: cuando la lesión no dice de qué lado es, se marcan los dos.
 * Marcar un lado al azar sería inventar un dato que la fuente no da.
 */
const BILATERAL: Record<string, string[]> = {
  hombro: ['hombro_izq', 'hombro_der', 'deltoides_izq', 'deltoides_der'],
  biceps: ['biceps_izq', 'biceps_der'],
  triceps: ['triceps_izq', 'triceps_der'],
  antebrazo: ['antebrazo_izq', 'antebrazo_der'],
  pectoral: ['pectoral_izq', 'pectoral_der'],
  oblicuo: ['oblicuo_izq', 'oblicuo_der'],
  cadera: ['cadera_izq', 'cadera_der'],
  aductor: ['aductor_izq', 'aductor_der'],
  cuadriceps: ['cuadriceps_izq', 'cuadriceps_der'],
  isquio: ['isquio_izq', 'isquio_der'],
  gluteo: ['gluteo_izq', 'gluteo_der'],
  rodilla: ['rodilla_izq', 'rodilla_der'],
  tibia: ['tibia_izq', 'tibia_der'],
  gemelo: ['gemelo_izq', 'gemelo_der'],
  tobillo: ['tobillo_izq', 'tobillo_der'],
  pie: ['pie_izq', 'pie_der'],
  aquiles: ['aquiles_izq', 'aquiles_der'],
  dorsal: ['dorsal_izq', 'dorsal_der'],
}

/** Palabras (inglés de API-Football y castellano) → grupo o zona única. */
const INJURY_KEYWORDS: Array<[RegExp, string]> = [
  [/knee|rodilla|meniscus|menisco|cruciate|cruzado|acl|lcl|mcl/, 'rodilla'],
  [/hamstring|isquio|biceps femoris/, 'isquio'],
  [/calf|gemelo|soleus|soleo/, 'gemelo'],
  [/achilles|aquiles/, 'aquiles'],
  [/ankle|tobillo/, 'tobillo'],
  [/foot|pie |metatars/, 'pie'],
  [/groin|adductor|aductor|pubalgia|ingle/, 'aductor'],
  [/quadriceps|quadricep|cuadriceps|thigh|muslo/, 'cuadriceps'],
  [/hip|cadera/, 'cadera'],
  [/glute|gluteo/, 'gluteo'],
  [/lumbar|lower back|espalda baja|lumbago/, 'lumbar'],
  [/back|espalda|spine|columna/, 'lumbar'],
  [/shoulder|hombro|clavicle|clavicula|deltoid/, 'hombro'],
  [/shin|tibia|fibula|perone/, 'tibia'],
  [/abdominal|abdomen|hernia/, 'abdomen'],
  [/oblique|oblicuo/, 'oblicuo'],
  [/chest|pectoral|rib|costilla/, 'pectoral'],
  [/forearm|antebrazo|wrist|muneca/, 'antebrazo'],
  [/bicep/, 'biceps'],
  [/tricep/, 'triceps'],
  [/neck|cuello|cervical/, 'cuello'],
  [/head|concussion|conmocion|cabeza|face|nose|nariz/, 'cabeza'],
  [/trapezius|trapecio/, 'trapecio'],
  [/lat |latissimus|dorsal/, 'dorsal'],
]

const ALL_IDS = new Set(BODY_ZONES.map(z => z.id))

/**
 * Traduce el texto de una lesión a las zonas del mapa que hay que marcar.
 *
 * Devuelve lista vacía cuando no reconoce la lesión: preferimos no marcar nada
 * antes que marcar una zona equivocada. Si el texto aclara el lado ("left knee")
 * se marca sólo ese; si no, se marcan los dos.
 */
export function zonesFromInjuryType(type: string): string[] {
  const t = type
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

  const group = INJURY_KEYWORDS.find(([re]) => re.test(t))?.[1]
  if (!group) return []

  // Zona única (no tiene lados): cabeza, abdomen, lumbar, cuello, trapecio.
  if (ALL_IDS.has(group)) return [group]

  const sides = BILATERAL[group]
  if (!sides) return []

  // Izquierda y derecha del espectador: el mapa se lee de frente.
  if (/\bleft\b|izquierd/.test(t)) return sides.filter(id => id.endsWith('_izq'))
  if (/\bright\b|derech/.test(t)) return sides.filter(id => id.endsWith('_der'))
  return sides
}
