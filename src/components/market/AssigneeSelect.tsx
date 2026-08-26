import { useEffect, useState } from 'react'
import { fetchTeamMembers } from '@/services/marketService'
import { useLanguage } from '@/context/LanguageContext'
import type { TeamMember } from '@/types/market'

export default function AssigneeSelect({ value, onChange }: { value: number | null; onChange: (id: number, name: string) => void }) {
  const { t } = useLanguage()
  const [members, setMembers] = useState<TeamMember[]>([])

  useEffect(() => {
    fetchTeamMembers().then(setMembers).catch(() => setMembers([]))
  }, [])

  return (
    <select
      value={value ?? ''}
      onChange={e => {
        const id = Number(e.target.value)
        const member = members.find(m => m.id === id)
        if (member) onChange(member.id, member.name)
      }}
      className="input-apple text-sm w-full"
    >
      <option value="" disabled>{t('mercado.elegirResponsable')}</option>
      {members.map(m => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  )
}
