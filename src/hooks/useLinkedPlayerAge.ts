import { useEffect, useState } from 'react'
import { fetchPlayerIdentity } from '@/services/marketService'
import { computeAge } from '@/utils/marketAlerts'

/**
 * Edad de un jugador ya vinculado a la API, para mostrar al lado del nombre
 * en Mercado (negociaciones y candidatos) apenas Matías o Marcos lo
 * vinculan — se recalcula en vivo desde `birth_date` en vez de guardarse
 * como dato estático, porque la edad cambia con el tiempo y guardarla
 * quedaría vieja. Null mientras no hay id, no se pudo resolver, o el
 * jugador no tiene fecha de nacimiento cargada.
 */
export function useLinkedPlayerAge(playerApiId: number | null): number | null {
  const [age, setAge] = useState<number | null>(null)

  useEffect(() => {
    if (playerApiId == null) { setAge(null); return }
    let active = true
    fetchPlayerIdentity(playerApiId).then(identity => {
      if (active) setAge(identity ? computeAge(identity.birth_date) : null)
    })
    return () => { active = false }
  }, [playerApiId])

  return age
}
