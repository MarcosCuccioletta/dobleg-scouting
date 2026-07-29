import { useEffect, useState } from 'react'

/**
 * Devuelve el valor después de que dejó de cambiar por `delay` ms. Sirve para no
 * pegarle a la base en cada tecla de un buscador.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
