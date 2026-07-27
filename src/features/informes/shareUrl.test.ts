import { describe, it, expect } from 'vitest'
import { informeShareKey, shareVersionToken, withVersion, brandedShareUrl, brandedOgImageUrl, informeOgImageKey } from './shareUrl'

describe('informeShareKey', () => {
  it('arma slug + token del id', () => {
    expect(informeShareKey('inf_abc123456', 'Juan Ignacio Díaz')).toBe('juan-ignacio-diaz-123456.html')
  })

  it('saca acentos y símbolos del nombre', () => {
    expect(informeShareKey('x'.repeat(10), 'Ñandú (2026)!')).toBe('nandu-2026-xxxxxx.html')
  })

  it('sin nombre usable cae a "informe"', () => {
    expect(informeShareKey('abc123456', '   ')).toBe('informe-123456.html')
  })

  it('es estable: el mismo informe da siempre la misma clave', () => {
    const a = informeShareKey('inf_zzz999', 'Luca Orellano')
    const b = informeShareKey('inf_zzz999', 'Luca Orellano')
    expect(a).toBe(b)
  })
})

describe('shareVersionToken', () => {
  it('cambia con el tiempo: es lo que fuerza a WhatsApp a re-leer el link', () => {
    expect(shareVersionToken(1000)).not.toBe(shareVersionToken(2_000_000))
  })

  it('es corto y seguro para una URL', () => {
    const t = shareVersionToken(1769470000000)
    expect(t).toMatch(/^[a-z0-9]{1,10}$/)
  })
})

describe('withVersion', () => {
  it('agrega ?v= cuando no hay query', () => {
    expect(withVersion('https://x.test/i/a.html', 'k9')).toBe('https://x.test/i/a.html?v=k9')
  })

  it('agrega &v= cuando ya hay query', () => {
    expect(withVersion('https://x.test/i/a.html?foo=1', 'k9')).toBe('https://x.test/i/a.html?foo=1&v=k9')
  })

  it('sin token devuelve la URL intacta', () => {
    expect(withVersion('https://x.test/i/a.html', '')).toBe('https://x.test/i/a.html')
  })
})

describe('brandedShareUrl', () => {
  it('arma el link del dominio propio', () => {
    expect(brandedShareUrl('inf_abc123456', 'Luca Orellano'))
      .toBe('https://dobleg-scouting.netlify.app/i/luca-orellano-123456.html')
  })

  it('con versión, el link cambia aunque el informe sea el mismo', () => {
    const a = brandedShareUrl('inf_abc123456', 'Luca Orellano', 'aa')
    const b = brandedShareUrl('inf_abc123456', 'Luca Orellano', 'bb')
    expect(a).not.toBe(b)
    expect(a).toContain('luca-orellano-123456.html?v=aa')
  })
})

describe('brandedOgImageUrl', () => {
  it('la tarjeta sale del mismo dominio y con la misma clave que el informe', () => {
    expect(informeOgImageKey('inf_abc123456', 'Luca Orellano')).toBe('luca-orellano-123456.jpg')
    expect(brandedOgImageUrl('inf_abc123456', 'Luca Orellano', 'aa'))
      .toBe('https://dobleg-scouting.netlify.app/i/luca-orellano-123456.jpg?v=aa')
  })

  it('la imagen y el informe comparten la versión', () => {
    const page = brandedShareUrl('inf_abc123456', 'Luca Orellano', 'zz')
    const img = brandedOgImageUrl('inf_abc123456', 'Luca Orellano', 'zz')
    expect(page.endsWith('?v=zz')).toBe(true)
    expect(img.endsWith('?v=zz')).toBe(true)
    expect(img.replace('.jpg', '.html')).toBe(page)
  })
})
