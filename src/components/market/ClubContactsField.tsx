import { useLanguage } from '@/context/LanguageContext'
import type { ClubContact } from '@/types/market'

/**
 * Lista editable de contactos de un club (nombre + cargo, cargo opcional).
 * Un club real casi siempre tiene mas de una persona util para una
 * negociacion, asi que en vez de un solo campo suelto se puede ir agregando
 * de a uno — el "+ Agregar otro contacto" solo aparece una vez que el
 * ultimo contacto ya tiene nombre cargado, para no mostrar filas vacias de
 * entrada. Las filas sin nombre se descartan al guardar (ver
 * `NewNegotiationForm.handleSave`), asi que no hace falta filtrar aca.
 */
export default function ClubContactsField({
  value,
  onChange,
}: {
  value: ClubContact[]
  onChange: (contacts: ClubContact[]) => void
}) {
  const { t } = useLanguage()
  const rows = value.length > 0 ? value : [{ name: '', role: null }]
  const lastHasName = rows[rows.length - 1].name.trim().length > 0

  const updateRow = (index: number, patch: Partial<ClubContact>) => {
    onChange(rows.map((r, i) => i === index ? { ...r, ...patch } : r))
  }

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onChange([...rows, { name: '', role: null }])
  }

  return (
    <div className="space-y-2">
      <p className="text-2xs text-apple-gray-400">{t('mercado.contactoClubLabel')}</p>
      {rows.map((contact, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={contact.name}
              onChange={e => updateRow(i, { name: e.target.value })}
              placeholder={t('mercado.responsableClubPlaceholder')}
              className="input-apple text-sm w-full"
            />
            <input
              type="text"
              value={contact.role ?? ''}
              onChange={e => updateRow(i, { role: e.target.value })}
              placeholder={t('mercado.cargoPlaceholder')}
              className="input-apple text-sm w-full"
            />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-apple-gray-300 hover:text-red-500 flex-shrink-0"
              title={t('mercado.quitar')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      {lastHasName && (
        <button
          type="button"
          onClick={addRow}
          className="text-xs font-medium text-brand-green hover:text-emerald-600"
        >
          + {t('mercado.agregarOtroContacto')}
        </button>
      )}
    </div>
  )
}
