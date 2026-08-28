import { useState } from 'react'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import type { InformeDT, InformeDTContent } from '../types'
import {
  computeRecord, computeComparativa, computeSistemas, computeDisciplina, computeFormaReciente,
} from '../coachAggregation'
import { saveInformeDT, newInformeDTId } from '../informeDTStore'
import Step1CoachYArchivo from './Step1CoachYArchivo'
import Step2GraficosDT from './Step2GraficosDT'
import Step3ContenidoDT from './Step3ContenidoDT'
import Step4PreviewDT from './Step4PreviewDT'

function buildContentFromMatches(coach: AgencyCoach, matches: WyscoutMatch[]): InformeDTContent {
  return {
    nombre: coach.fullName,
    cargo: 'Director Técnico',
    club: coach.club ?? '',
    liga: coach.leagueName ?? '',
    sistemaHabitual: computeSistemas(matches)[0]?.formacion ?? '',
    edad: '',
    fotoDataUrl: coach.photo,
    record: computeRecord(matches),
    comparativa: computeComparativa(matches),
    radarAxes: ['posesion', 'duelos', 'duelosAereos', 'precisionPase', 'xg', 'ppda'],
    evolutionCharts: ['posesion', 'xg'],
    sistemas: computeSistemas(matches),
    disciplina: computeDisciplina(matches),
    formaReciente: computeFormaReciente(matches),
    experienciaJugador: {
      incluir: false, edad: '', lugarNacimiento: '', altura: '', posicion: '', pieHabil: '', seleccion: '',
      titulos: [], trayectoria: [],
    },
    carreraDT: coach.club ? [{ club: coach.club, periodo: 'Actualidad', liga: coach.leagueName ?? null, logoUrl: coach.photo }] : [],
  }
}

export default function InformeDTWizard({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0)
  const [informe, setInforme] = useState<InformeDT | null>(null)

  if (step === 0) {
    return (
      <Step1CoachYArchivo
        onNext={(coach, matches) => {
          const content = buildContentFromMatches(coach, matches)
          setInforme({
            id: newInformeDTId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            coachKey: coach.key, content, matches,
          })
          setStep(1)
        }}
      />
    )
  }

  if (!informe) return null

  if (step === 1) {
    return (
      <Step2GraficosDT
        radarAxes={informe.content.radarAxes}
        evolutionCharts={informe.content.evolutionCharts}
        onChange={(radarAxes, evolutionCharts) =>
          setInforme({ ...informe, content: { ...informe.content, radarAxes, evolutionCharts } })
        }
        onBack={() => setStep(0)}
        onNext={() => setStep(2)}
      />
    )
  }

  if (step === 2) {
    return (
      <Step3ContenidoDT
        content={informe.content}
        onChange={content => setInforme({ ...informe, content })}
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
      />
    )
  }

  return (
    <Step4PreviewDT
      informe={informe}
      onBack={() => setStep(2)}
      onSave={() => {
        saveInformeDT({ ...informe, updatedAt: new Date().toISOString() })
        onExit()
      }}
    />
  )
}
