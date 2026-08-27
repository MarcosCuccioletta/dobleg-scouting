import { useState } from 'react'
import GpsDropzone from '@/features/gps/components/GpsDropzone'
import { parseWyscoutTeamStatsXlsx, type WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import { matchFixtureForRow, verifyCoachForFixture } from '@/features/coaches/wyscoutTeamStats/matchFixtures'
import { upsertCoachMatchTeamStats } from '@/services/coachService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import type { AgencyFixture } from '@/types/footballApi'
import { useLanguage } from '@/context/LanguageContext'

interface ReviewRow {
  wyscout: WyscoutMatch
  fixture: AgencyFixture | null
  coachVerified: boolean | null
  coachNameFromApi: string | null
  included: boolean
}

export default function CoachWyscoutUploadPanel({
  coach,
  fixtures,
  onSaved,
}: {
  coach: AgencyCoach
  fixtures: AgencyFixture[]
  onSaved: () => void
}) {
  const { t } = useLanguage()
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (!coach.club || !coach.apiTeamId) return
    setParsing(true)
    setParseError(null)
    setFileName(file.name)
    try {
      const data = await file.arrayBuffer()
      const matches = await parseWyscoutTeamStatsXlsx(data, coach.club)
      const withFixtures = await Promise.all(
        matches.map(async wyscout => {
          const fixture = matchFixtureForRow(wyscout, fixtures)
          if (!fixture || !coach.apiTeamId) {
            return { wyscout, fixture, coachVerified: null, coachNameFromApi: null, included: !!fixture }
          }
          const { verified, coachName } = await verifyCoachForFixture(fixture.fixtureId, coach.apiTeamId, coach.fullName)
          return { wyscout, fixture, coachVerified: verified, coachNameFromApi: coachName, included: verified }
        }),
      )
      setRows(withFixtures)
    } catch {
      setParseError(t('coachDetail.wyscoutErrorLectura'))
      setFileName(null)
    } finally {
      setParsing(false)
    }
  }

  const resetUpload = () => {
    setRows(null)
    setFileName(null)
    setParseError(null)
  }

  const toggleIncluded = (index: number) => {
    setRows(prev => prev?.map((r, i) => (i === index ? { ...r, included: !r.included } : r)) ?? null)
  }

  const handleSave = async () => {
    if (!rows) return
    setSaving(true)
    setSaveError(null)
    try {
      const toSave = rows.filter(r => r.included && r.fixture)
      let failedCount = 0
      for (const row of toSave) {
        const result = await upsertCoachMatchTeamStats(coach.key, row.fixture!.fixtureId, {
          possessionPct: row.wyscout.possessionPct,
          xgFor: row.wyscout.xgFor,
          xgAgainst: row.wyscout.xgAgainst,
          rawMetrics: row.wyscout.rawMetrics,
          sourceFile: fileName,
        })
        if (!result.success) failedCount += 1
      }
      if (failedCount > 0) {
        setSaveError(t(failedCount === 1 ? 'coachDetail.wyscoutErrorGuardarUno' : 'coachDetail.wyscoutErrorGuardarVarios').replace('{count}', String(failedCount)))
        return
      }
      setRows(null)
      setFileName(null)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  if (!rows) {
    return (
      <div className="space-y-3">
        {parseError && (
          <div className="rounded-apple-lg border border-brand-red/40 bg-brand-red/10 px-3 sm:px-4 py-2.5 text-sm text-brand-red">
            {parseError}
          </div>
        )}
        <GpsDropzone
          onFile={file => void handleFile(file)}
          disabled={parsing}
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          label={parsing ? t('coachDetail.wyscoutLeyendo') : t('coachDetail.wyscoutArrastra')}
          hint={t('coachDetail.wyscoutHint')}
        />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 bg-apple-gray-50 dark:bg-apple-gray-900/40 px-3 sm:px-4 py-4 text-sm text-apple-gray-500 dark:text-apple-gray-400 text-center">
          {t('coachDetail.wyscoutSinPartidos').replace('{club}', coach.club ?? '')}
        </div>
        <button
          type="button"
          onClick={resetUpload}
          className="text-sm text-apple-gray-500 hover:text-apple-gray-700 dark:hover:text-apple-gray-300"
        >
          {t('coachDetail.wyscoutProbarOtro')}
        </button>
      </div>
    )
  }

  const includedCount = rows.filter(r => r.included && r.fixture).length

  return (
    <div className="space-y-3">
      {saveError && (
        <div className="rounded-apple-lg border border-brand-red/40 bg-brand-red/10 px-3 sm:px-4 py-2.5 text-sm text-brand-red">
          {saveError}
        </div>
      )}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 px-3 sm:px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-apple-gray-800 dark:text-white truncate">
                vs {row.wyscout.equipoRival} · {row.wyscout.fecha}
              </p>
              {!row.fixture && <p className="text-2xs text-brand-red">{t('coachDetail.wyscoutSinAgenda')}</p>}
              {row.fixture && row.coachVerified === true && (
                <p className="text-2xs text-brand-green">{t('coachDetail.wyscoutDtConfirmado').replace('{name}', row.coachNameFromApi ?? '')}</p>
              )}
              {row.fixture && row.coachVerified === false && (
                <p className="text-2xs text-amber-500">
                  {row.coachNameFromApi
                    ? t('coachDetail.wyscoutDtDiscrepancia').replace('{name}', row.coachNameFromApi).replace('{coach}', coach.fullName)
                    : t('coachDetail.wyscoutNoVerificado')}
                </p>
              )}
            </div>
            {row.fixture && (
              <label className="flex items-center gap-1.5 text-2xs text-apple-gray-500 flex-shrink-0">
                <input type="checkbox" checked={row.included} onChange={() => toggleIncluded(i)} />
                {t('coachDetail.incluir')}
              </label>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || includedCount === 0}
          className="min-h-[40px] px-4 rounded-full bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? t('coachDetail.guardando') : t(includedCount === 1 ? 'coachDetail.guardarUno' : 'coachDetail.guardarVarios').replace('{count}', String(includedCount))}
        </button>
        <button
          type="button"
          onClick={resetUpload}
          disabled={saving}
          className="text-sm text-apple-gray-500 hover:text-apple-gray-700 dark:hover:text-apple-gray-300 disabled:opacity-50"
        >
          {t('coachDetail.cancelar')}
        </button>
      </div>
    </div>
  )
}
