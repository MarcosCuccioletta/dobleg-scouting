import { useState, useEffect, useCallback } from 'react'
import type { ManagementStatus, MonitoringPlayerStatus, ScoreHistoryEntry } from '@/types'

const STORAGE_KEY = 'scout_monitoring_status'

interface MonitoringStatusStore {
  players: Record<string, MonitoringPlayerStatus>
  lastUpdated: string
}

function loadFromStorage(): MonitoringStatusStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Error loading monitoring status from localStorage:', e)
  }
  return { players: {}, lastUpdated: new Date().toISOString() }
}

function saveToStorage(store: MonitoringStatusStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (e) {
    console.error('Error saving monitoring status to localStorage:', e)
  }
}

export function useMonitoringStatus() {
  const [store, setStore] = useState<MonitoringStatusStore>(loadFromStorage)

  // Save to localStorage whenever store changes
  useEffect(() => {
    saveToStorage(store)
  }, [store])

  // Get status for a specific player
  const getPlayerStatus = useCallback((playerId: string): MonitoringPlayerStatus | null => {
    return store.players[playerId] || null
  }, [store.players])

  // Set management status for a player
  const setPlayerStatus = useCallback((playerId: string, status: ManagementStatus) => {
    setStore(prev => {
      const existing = prev.players[playerId]
      const now = new Date().toISOString()

      return {
        ...prev,
        lastUpdated: now,
        players: {
          ...prev.players,
          [playerId]: {
            playerId,
            status,
            scoreHistory: existing?.scoreHistory || [],
            notes: existing?.notes,
            lastUpdated: now,
          }
        }
      }
    })
  }, [])

  // Add a score history entry for a player
  const addScoreHistory = useCallback((
    playerId: string,
    ggScore: number,
    opportunityScore?: number
  ) => {
    setStore(prev => {
      const existing = prev.players[playerId]
      const now = new Date().toISOString()
      const today = now.split('T')[0]

      // Don't add duplicate entry for the same day
      const existingHistory = existing?.scoreHistory || []
      const todayEntry = existingHistory.find(e => e.date.startsWith(today))
      if (todayEntry) {
        // Update existing entry for today
        return {
          ...prev,
          lastUpdated: now,
          players: {
            ...prev.players,
            [playerId]: {
              ...existing,
              playerId,
              status: existing?.status || 'en_seguimiento',
              scoreHistory: existingHistory.map(e =>
                e.date.startsWith(today)
                  ? { ...e, ggScore, opportunityScore }
                  : e
              ),
              lastUpdated: now,
            }
          }
        }
      }

      // Add new entry
      const newEntry: ScoreHistoryEntry = {
        date: now,
        ggScore,
        opportunityScore,
      }

      return {
        ...prev,
        lastUpdated: now,
        players: {
          ...prev.players,
          [playerId]: {
            playerId,
            status: existing?.status || 'en_seguimiento',
            scoreHistory: [...existingHistory, newEntry].slice(-24), // Keep last 24 entries
            notes: existing?.notes,
            lastUpdated: now,
          }
        }
      }
    })
  }, [])

  // Update notes for a player
  const setPlayerNotes = useCallback((playerId: string, notes: string) => {
    setStore(prev => {
      const existing = prev.players[playerId]
      const now = new Date().toISOString()

      return {
        ...prev,
        lastUpdated: now,
        players: {
          ...prev.players,
          [playerId]: {
            ...existing,
            playerId,
            status: existing?.status || 'en_seguimiento',
            scoreHistory: existing?.scoreHistory || [],
            notes,
            lastUpdated: now,
          }
        }
      }
    })
  }, [])

  // Get all players with a specific status
  const getPlayersByStatus = useCallback((status: ManagementStatus): string[] => {
    return Object.entries(store.players)
      .filter(([, p]) => p.status === status)
      .map(([id]) => id)
  }, [store.players])

  // Get score trend (last N entries)
  const getScoreTrend = useCallback((playerId: string, entries = 6): ScoreHistoryEntry[] => {
    const player = store.players[playerId]
    if (!player) return []
    return player.scoreHistory.slice(-entries)
  }, [store.players])

  // Calculate score change (latest vs oldest in history)
  const getScoreChange = useCallback((playerId: string): number | null => {
    const player = store.players[playerId]
    if (!player || player.scoreHistory.length < 2) return null

    const oldest = player.scoreHistory[0]
    const newest = player.scoreHistory[player.scoreHistory.length - 1]
    return Math.round((newest.ggScore - oldest.ggScore) * 10) / 10
  }, [store.players])

  // Batch update scores for all players (call this on data load)
  const syncScores = useCallback((
    players: Array<{ id: string; ggScore: number | null; opportunityScore?: number | null }>
  ) => {
    const today = new Date().toISOString().split('T')[0]

    setStore(prev => {
      const updated = { ...prev }
      let hasChanges = false

      for (const { id, ggScore, opportunityScore } of players) {
        if (ggScore === null) continue

        const existing = prev.players[id]
        const existingHistory = existing?.scoreHistory || []

        // Check if we already have an entry for today
        const todayEntry = existingHistory.find(e => e.date.startsWith(today))
        if (todayEntry && todayEntry.ggScore === ggScore) continue

        hasChanges = true
        const now = new Date().toISOString()

        if (todayEntry) {
          // Update existing entry
          updated.players = {
            ...updated.players,
            [id]: {
              ...existing,
              playerId: id,
              status: existing?.status || 'en_seguimiento',
              scoreHistory: existingHistory.map(e =>
                e.date.startsWith(today)
                  ? { ...e, ggScore, opportunityScore: opportunityScore ?? undefined }
                  : e
              ),
              lastUpdated: now,
            }
          }
        } else {
          // Add new entry
          updated.players = {
            ...updated.players,
            [id]: {
              playerId: id,
              status: existing?.status || 'en_seguimiento',
              scoreHistory: [
                ...existingHistory,
                { date: now, ggScore, opportunityScore: opportunityScore ?? undefined }
              ].slice(-24),
              notes: existing?.notes,
              lastUpdated: now,
            }
          }
        }
      }

      if (hasChanges) {
        updated.lastUpdated = new Date().toISOString()
      }

      return hasChanges ? updated : prev
    })
  }, [])

  return {
    store,
    getPlayerStatus,
    setPlayerStatus,
    addScoreHistory,
    setPlayerNotes,
    getPlayersByStatus,
    getScoreTrend,
    getScoreChange,
    syncScores,
  }
}

// Status labels and colors
export const STATUS_CONFIG: Record<ManagementStatus, { label: string; color: string; bgColor: string }> = {
  en_seguimiento: {
    label: 'En seguimiento',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  contactado: {
    label: 'Contactado',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  en_negociacion: {
    label: 'En negociacion',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  descartado: {
    label: 'Descartado',
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
  },
}
