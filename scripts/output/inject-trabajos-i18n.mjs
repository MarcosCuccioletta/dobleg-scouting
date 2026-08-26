import fs from 'fs'
const path = 'src/constants/translations.ts'
let src = fs.readFileSync(path, 'utf8')

const blocks = {
  es: {
    anchor: "'nav.trabajos': 'Trabajos',",
    keys: {
      estadoCompletado: 'Completado', estadoEnProgreso: 'En Progreso', estadoProximamente: 'Próximamente',
      countJugadores: '{count} jugadores', countDestacados: '{count} destacados',
      rol: 'Rol:', ataque: 'Ataque', mediocampo: 'Mediocampo', defensa: 'Defensa', porteria: 'Portería',
      destacado: 'Destacado', evaluado: 'Evaluado', verEnTransfermarkt: 'Ver en Transfermarkt',
      volverAProyectos: 'Volver a Proyectos', buscarJugador: 'Buscar jugador...', todos: 'Todos',
      destacadosFiltro: 'Destacados', todasLasPosiciones: 'Todas las posiciones',
      jugadoresConCount: 'Jugadores ({count})', sinJugadoresFiltro: 'No se encontraron jugadores con los filtros seleccionados.',
      titulo: 'Trabajos de Scouting', subtitulo: 'Proyectos de scouting y evaluación de talentos en competiciones juveniles',
      masProyectos: 'Más proyectos de scouting próximamente',
    },
  },
  en: {
    anchor: "'nav.trabajos': 'Jobs',",
    keys: {
      estadoCompletado: 'Completed', estadoEnProgreso: 'In Progress', estadoProximamente: 'Upcoming',
      countJugadores: '{count} players', countDestacados: '{count} highlighted',
      rol: 'Role:', ataque: 'Attack', mediocampo: 'Midfield', defensa: 'Defense', porteria: 'Goalkeeping',
      destacado: 'Highlighted', evaluado: 'Evaluated', verEnTransfermarkt: 'View on Transfermarkt',
      volverAProyectos: 'Back to Projects', buscarJugador: 'Search player...', todos: 'All',
      destacadosFiltro: 'Highlighted', todasLasPosiciones: 'All positions',
      jugadoresConCount: 'Players ({count})', sinJugadoresFiltro: 'No players found with the selected filters.',
      titulo: 'Scouting Works', subtitulo: 'Scouting and talent evaluation projects in youth competitions',
      masProyectos: 'More scouting projects coming soon',
    },
  },
  tr: {
    anchor: "'nav.trabajos': 'İşler',",
    keys: {
      estadoCompletado: 'Tamamlandı', estadoEnProgreso: 'Devam Ediyor', estadoProximamente: 'Yakında',
      countJugadores: '{count} oyuncu', countDestacados: '{count} öne çıkan',
      rol: 'Rol:', ataque: 'Hücum', mediocampo: 'Orta Saha', defensa: 'Defans', porteria: 'Kalecilik',
      destacado: 'Öne çıkan', evaluado: 'Değerlendirildi', verEnTransfermarkt: 'Transfermarkt\'ta gör',
      volverAProyectos: 'Projelere Dön', buscarJugador: 'Oyuncu ara...', todos: 'Tümü',
      destacadosFiltro: 'Öne çıkanlar', todasLasPosiciones: 'Tüm pozisyonlar',
      jugadoresConCount: 'Oyuncular ({count})', sinJugadoresFiltro: 'Seçilen filtrelerle oyuncu bulunamadı.',
      titulo: 'Scouting Çalışmaları', subtitulo: 'Genç kategorilerdeki scouting ve yetenek değerlendirme projeleri',
      masProyectos: 'Yakında daha fazla scouting projesi',
    },
  },
  it: {
    anchor: "'nav.trabajos': 'Lavori',",
    keys: {
      estadoCompletado: 'Completato', estadoEnProgreso: 'In Corso', estadoProximamente: 'Prossimamente',
      countJugadores: '{count} giocatori', countDestacados: '{count} in evidenza',
      rol: 'Ruolo:', ataque: 'Attacco', mediocampo: 'Centrocampo', defensa: 'Difesa', porteria: 'Portieri',
      destacado: 'In evidenza', evaluado: 'Valutato', verEnTransfermarkt: 'Vedi su Transfermarkt',
      volverAProyectos: 'Torna ai Progetti', buscarJugador: 'Cerca giocatore...', todos: 'Tutti',
      destacadosFiltro: 'In evidenza', todasLasPosiciones: 'Tutte le posizioni',
      jugadoresConCount: 'Giocatori ({count})', sinJugadoresFiltro: 'Nessun giocatore trovato con i filtri selezionati.',
      titulo: 'Lavori di Scouting', subtitulo: 'Progetti di scouting e valutazione dei talenti in competizioni giovanili',
      masProyectos: 'Altri progetti di scouting in arrivo',
    },
  },
  fr: {
    anchor: "'nav.trabajos': 'Travaux',",
    keys: {
      estadoCompletado: 'Terminé', estadoEnProgreso: 'En Cours', estadoProximamente: 'Bientôt',
      countJugadores: '{count} joueurs', countDestacados: '{count} en vedette',
      rol: 'Rôle :', ataque: 'Attaque', mediocampo: 'Milieu', defensa: 'Défense', porteria: 'Gardiens',
      destacado: 'En vedette', evaluado: 'Évalué', verEnTransfermarkt: 'Voir sur Transfermarkt',
      volverAProyectos: 'Retour aux Projets', buscarJugador: 'Rechercher un joueur...', todos: 'Tous',
      destacadosFiltro: 'En vedette', todasLasPosiciones: 'Tous les postes',
      jugadoresConCount: 'Joueurs ({count})', sinJugadoresFiltro: 'Aucun joueur trouvé avec les filtres sélectionnés.',
      titulo: 'Travaux de Scouting', subtitulo: 'Projets de scouting et d\'évaluation de talents dans les compétitions jeunes',
      masProyectos: 'Plus de projets de scouting bientôt',
    },
  },
  de: {
    anchor: "'nav.trabajos': 'Aufgaben',",
    keys: {
      estadoCompletado: 'Abgeschlossen', estadoEnProgreso: 'In Bearbeitung', estadoProximamente: 'Demnächst',
      countJugadores: '{count} Spieler', countDestacados: '{count} hervorgehoben',
      rol: 'Rolle:', ataque: 'Angriff', mediocampo: 'Mittelfeld', defensa: 'Abwehr', porteria: 'Torhüter',
      destacado: 'Hervorgehoben', evaluado: 'Bewertet', verEnTransfermarkt: 'Auf Transfermarkt ansehen',
      volverAProyectos: 'Zurück zu Projekten', buscarJugador: 'Spieler suchen...', todos: 'Alle',
      destacadosFiltro: 'Hervorgehoben', todasLasPosiciones: 'Alle Positionen',
      jugadoresConCount: 'Spieler ({count})', sinJugadoresFiltro: 'Keine Spieler mit den ausgewählten Filtern gefunden.',
      titulo: 'Scouting-Arbeiten', subtitulo: 'Scouting- und Talentbewertungsprojekte in Jugendwettbewerben',
      masProyectos: 'Weitere Scouting-Projekte in Kürze',
    },
  },
  ar: {
    anchor: "'nav.trabajos': 'الأعمال',",
    keys: {
      estadoCompletado: 'مكتمل', estadoEnProgreso: 'قيد التنفيذ', estadoProximamente: 'قريبًا',
      countJugadores: '{count} لاعب', countDestacados: '{count} مميز',
      rol: 'الدور:', ataque: 'الهجوم', mediocampo: 'الوسط', defensa: 'الدفاع', porteria: 'حراسة المرمى',
      destacado: 'مميز', evaluado: 'تم تقييمه', verEnTransfermarkt: 'عرض في Transfermarkt',
      volverAProyectos: 'العودة إلى المشاريع', buscarJugador: 'ابحث عن لاعب...', todos: 'الكل',
      destacadosFiltro: 'المميزون', todasLasPosiciones: 'جميع المراكز',
      jugadoresConCount: 'اللاعبون ({count})', sinJugadoresFiltro: 'لم يتم العثور على لاعبين بهذه الفلاتر.',
      titulo: 'أعمال الاستكشاف', subtitulo: 'مشاريع الاستكشاف وتقييم المواهب في بطولات الشباب',
      masProyectos: 'المزيد من مشاريع الاستكشاف قريبًا',
    },
  },
  zh: {
    anchor: "'nav.trabajos': '工作',",
    keys: {
      estadoCompletado: '已完成', estadoEnProgreso: '进行中', estadoProximamente: '即将开始',
      countJugadores: '{count} 名球员', countDestacados: '{count} 名重点球员',
      rol: '角色：', ataque: '前锋线', mediocampo: '中场', defensa: '后防线', porteria: '门将',
      destacado: '重点关注', evaluado: '已评估', verEnTransfermarkt: '在Transfermarkt查看',
      volverAProyectos: '返回项目', buscarJugador: '搜索球员...', todos: '全部',
      destacadosFiltro: '重点关注', todasLasPosiciones: '所有位置',
      jugadoresConCount: '球员（{count}）', sinJugadoresFiltro: '未找到符合所选筛选条件的球员。',
      titulo: '球探工作', subtitulo: '青年赛事中的球探与人才评估项目',
      masProyectos: '更多球探项目即将推出',
    },
  },
  ja: {
    anchor: "'nav.trabajos': '業務',",
    keys: {
      estadoCompletado: '完了', estadoEnProgreso: '進行中', estadoProximamente: '近日公開',
      countJugadores: '{count}人の選手', countDestacados: '{count}人の注目選手',
      rol: '役割：', ataque: '攻撃', mediocampo: '中盤', defensa: '守備', porteria: 'ゴールキーピング',
      destacado: '注目', evaluado: '評価済み', verEnTransfermarkt: 'Transfermarktで見る',
      volverAProyectos: 'プロジェクト一覧に戻る', buscarJugador: '選手を検索...', todos: 'すべて',
      destacadosFiltro: '注目選手', todasLasPosiciones: 'すべてのポジション',
      jugadoresConCount: '選手（{count}）', sinJugadoresFiltro: '選択したフィルターに一致する選手が見つかりません。',
      titulo: 'スカウト業務', subtitulo: 'ユース大会でのスカウティングと才能評価プロジェクト',
      masProyectos: '今後さらにスカウティングプロジェクトを追加予定',
    },
  },
}

let count = 0
for (const [lang, { anchor, keys }] of Object.entries(blocks)) {
  if (!src.includes(anchor)) { console.error('ANCHOR NOT FOUND for', lang, ':', anchor); continue }
  const lines = Object.entries(keys).map(([k, v]) => `    'trabajos.${k}': ${JSON.stringify(v)},`).join('\n')
  src = src.replace(anchor, `${anchor}\n${lines}`)
  count++
}

fs.writeFileSync(path, src, 'utf8')
console.log('OK inserted for', count, 'languages')
