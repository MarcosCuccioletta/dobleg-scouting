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
  // El nombre de equipo que efectivamente matcheó en el archivo de Wyscout
  // (`matches[0].equipoPropio`) es más confiable que `coach.club` para lo que se
  // muestra en el informe: existe siempre que haya matches, y es el que corresponde
  // exactamente a los datos cargados — a diferencia de `coach.club`, que puede estar
  // vacío (entrenador sin club) o escrito distinto al nombre usado por Wyscout.
  const club = matches[0]?.equipoPropio ?? coach.club ?? ''
  return {
    nombre: coach.fullName,
    cargo: 'Director Técnico',
    club,
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
    // logoUrl: null — no hay una fuente de escudos de club en este codebase todavía;
    // coach.photo es la foto de la PERSONA (headshot), no un escudo, y buildInformeDTHtml
    // la renderiza en un <img> de 20x20 al lado del nombre del club como si lo fuera.
    carreraDT: coach.club ? [{ club, periodo: 'Actualidad', liga: coach.leagueName ?? null, logoUrl: null }] : [],
  }
}

export default function InformeDTWizard({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0)
  const [informe, setInforme] = useState<InformeDT | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

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
    <div className="space-y-2">
      <Step4PreviewDT
        informe={informe}
        onBack={() => setStep(2)}
        onSave={() => {
          setSaveError(null)
          try {
            saveInformeDT({ ...informe, updatedAt: new Date().toISOString() })
            onExit()
          } catch (e) {
            setSaveError(e instanceof Error ? e.message : 'No se pudo guardar el informe.')
          }
        }}
      />
      {saveError && <p className="text-sm text-red-500 text-center">{saveError}</p>}
    </div>
  )
}
