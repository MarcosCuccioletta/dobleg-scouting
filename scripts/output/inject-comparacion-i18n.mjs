import fs from 'fs'
const path = 'src/constants/translations.ts'
let src = fs.readFileSync(path, 'utf8')

const blocks = {
  es: {
    anchor: "'nav.comparaciones': 'Comparaciones',",
    keys: {
      titulo: 'Comparación de Jugadores', subtitulo: 'Selecciona 2 o 3 jugadores para comparar',
      buscarPlaceholder: 'Escribir nombre del jugador...', jugadorA: 'Jugador A', jugadorB: 'Jugador B', jugadorC: 'Jugador C',
      tercerJugador: '+ 3er jugador', quitar: 'Quitar',
      seleccionaAlMenos2: 'Selecciona al menos 2 jugadores',
      buscaYSelecciona: 'Busca y selecciona los jugadores que quieres comparar usando los campos de búsqueda de arriba.',
      edad: 'Edad', valorDeMercado: 'Valor de Mercado', mejor: 'Mejor', masEconomico: 'Más económico',
      radarTitulo: 'Comparación Radar', metricasClave: 'Métricas clave', personalizado: 'Personalizado',
      metricasImportantes: 'Métricas importantes para esta posición', restablecer: 'Restablecer',
      cerrar: 'Cerrar', personalizar: 'Personalizar', seleccionaMetricas: 'Selecciona las métricas a comparar:',
      reporteTitulo: 'Comparación: {names}', reporteDescripcion: 'Comparación detallada de {count} jugadores.',
    },
  },
  en: {
    anchor: "'nav.comparaciones': 'Comparisons',",
    keys: {
      titulo: 'Player Comparison', subtitulo: 'Select 2 or 3 players to compare',
      buscarPlaceholder: 'Type player name...', jugadorA: 'Player A', jugadorB: 'Player B', jugadorC: 'Player C',
      tercerJugador: '+ 3rd player', quitar: 'Remove',
      seleccionaAlMenos2: 'Select at least 2 players',
      buscaYSelecciona: 'Search and select the players you want to compare using the search fields above.',
      edad: 'Age', valorDeMercado: 'Market Value', mejor: 'Best', masEconomico: 'Cheapest',
      radarTitulo: 'Radar Comparison', metricasClave: 'Key metrics', personalizado: 'Custom',
      metricasImportantes: 'Metrics that matter for this position', restablecer: 'Reset',
      cerrar: 'Close', personalizar: 'Customize', seleccionaMetricas: 'Select the metrics to compare:',
      reporteTitulo: 'Comparison: {names}', reporteDescripcion: 'Detailed comparison of {count} players.',
    },
  },
  tr: {
    anchor: "'nav.comparaciones': 'Karşılaştırmalar',",
    keys: {
      titulo: 'Oyuncu Karşılaştırması', subtitulo: 'Karşılaştırmak için 2 veya 3 oyuncu seç',
      buscarPlaceholder: 'Oyuncu adını yaz...', jugadorA: 'Oyuncu A', jugadorB: 'Oyuncu B', jugadorC: 'Oyuncu C',
      tercerJugador: '+ 3. oyuncu', quitar: 'Kaldır',
      seleccionaAlMenos2: 'En az 2 oyuncu seç',
      buscaYSelecciona: 'Yukarıdaki arama alanlarını kullanarak karşılaştırmak istediğin oyuncuları ara ve seç.',
      edad: 'Yaş', valorDeMercado: 'Piyasa Değeri', mejor: 'En iyi', masEconomico: 'En ucuz',
      radarTitulo: 'Radar Karşılaştırması', metricasClave: 'Temel metrikler', personalizado: 'Özel',
      metricasImportantes: 'Bu pozisyon için önemli metrikler', restablecer: 'Sıfırla',
      cerrar: 'Kapat', personalizar: 'Özelleştir', seleccionaMetricas: 'Karşılaştırılacak metrikleri seç:',
      reporteTitulo: 'Karşılaştırma: {names}', reporteDescripcion: '{count} oyuncunun detaylı karşılaştırması.',
    },
  },
  it: {
    anchor: "'nav.comparaciones': 'Confronti',",
    keys: {
      titulo: 'Confronto Giocatori', subtitulo: 'Seleziona 2 o 3 giocatori da confrontare',
      buscarPlaceholder: 'Scrivi il nome del giocatore...', jugadorA: 'Giocatore A', jugadorB: 'Giocatore B', jugadorC: 'Giocatore C',
      tercerJugador: '+ 3° giocatore', quitar: 'Rimuovi',
      seleccionaAlMenos2: 'Seleziona almeno 2 giocatori',
      buscaYSelecciona: 'Cerca e seleziona i giocatori che vuoi confrontare usando i campi di ricerca qui sopra.',
      edad: 'Età', valorDeMercado: 'Valore di Mercato', mejor: 'Migliore', masEconomico: 'Più economico',
      radarTitulo: 'Confronto Radar', metricasClave: 'Metriche chiave', personalizado: 'Personalizzato',
      metricasImportantes: 'Metriche importanti per questa posizione', restablecer: 'Ripristina',
      cerrar: 'Chiudi', personalizar: 'Personalizza', seleccionaMetricas: 'Seleziona le metriche da confrontare:',
      reporteTitulo: 'Confronto: {names}', reporteDescripcion: 'Confronto dettagliato di {count} giocatori.',
    },
  },
  fr: {
    anchor: "'nav.comparaciones': 'Comparaisons',",
    keys: {
      titulo: 'Comparaison de Joueurs', subtitulo: 'Sélectionnez 2 ou 3 joueurs à comparer',
      buscarPlaceholder: 'Saisir le nom du joueur...', jugadorA: 'Joueur A', jugadorB: 'Joueur B', jugadorC: 'Joueur C',
      tercerJugador: '+ 3e joueur', quitar: 'Retirer',
      seleccionaAlMenos2: 'Sélectionnez au moins 2 joueurs',
      buscaYSelecciona: 'Recherchez et sélectionnez les joueurs que vous voulez comparer avec les champs de recherche ci-dessus.',
      edad: 'Âge', valorDeMercado: 'Valeur Marchande', mejor: 'Meilleur', masEconomico: 'Le moins cher',
      radarTitulo: 'Comparaison Radar', metricasClave: 'Métriques clés', personalizado: 'Personnalisé',
      metricasImportantes: 'Métriques importantes pour ce poste', restablecer: 'Réinitialiser',
      cerrar: 'Fermer', personalizar: 'Personnaliser', seleccionaMetricas: 'Sélectionnez les métriques à comparer :',
      reporteTitulo: 'Comparaison : {names}', reporteDescripcion: 'Comparaison détaillée de {count} joueurs.',
    },
  },
  de: {
    anchor: "'nav.comparaciones': 'Vergleiche',",
    keys: {
      titulo: 'Spielervergleich', subtitulo: 'Wähle 2 oder 3 Spieler zum Vergleichen',
      buscarPlaceholder: 'Spielername eingeben...', jugadorA: 'Spieler A', jugadorB: 'Spieler B', jugadorC: 'Spieler C',
      tercerJugador: '+ 3. Spieler', quitar: 'Entfernen',
      seleccionaAlMenos2: 'Wähle mindestens 2 Spieler',
      buscaYSelecciona: 'Suche und wähle die Spieler, die du vergleichen möchtest, über die Suchfelder oben.',
      edad: 'Alter', valorDeMercado: 'Marktwert', mejor: 'Bester', masEconomico: 'Günstigster',
      radarTitulo: 'Radar-Vergleich', metricasClave: 'Wichtige Kennzahlen', personalizado: 'Angepasst',
      metricasImportantes: 'Wichtige Kennzahlen für diese Position', restablecer: 'Zurücksetzen',
      cerrar: 'Schließen', personalizar: 'Anpassen', seleccionaMetricas: 'Wähle die zu vergleichenden Kennzahlen:',
      reporteTitulo: 'Vergleich: {names}', reporteDescripcion: 'Detaillierter Vergleich von {count} Spielern.',
    },
  },
  ar: {
    anchor: "'nav.comparaciones': 'المقارنات',",
    keys: {
      titulo: 'مقارنة اللاعبين', subtitulo: 'اختر لاعبين أو 3 للمقارنة',
      buscarPlaceholder: 'اكتب اسم اللاعب...', jugadorA: 'اللاعب A', jugadorB: 'اللاعب B', jugadorC: 'اللاعب C',
      tercerJugador: '+ لاعب ثالث', quitar: 'إزالة',
      seleccionaAlMenos2: 'اختر لاعبين على الأقل',
      buscaYSelecciona: 'ابحث واختر اللاعبين الذين تريد مقارنتهم باستخدام حقول البحث أعلاه.',
      edad: 'العمر', valorDeMercado: 'القيمة السوقية', mejor: 'الأفضل', masEconomico: 'الأرخص',
      radarTitulo: 'مقارنة الرادار', metricasClave: 'المقاييس الرئيسية', personalizado: 'مخصص',
      metricasImportantes: 'مقاييس مهمة لهذا المركز', restablecer: 'إعادة تعيين',
      cerrar: 'إغلاق', personalizar: 'تخصيص', seleccionaMetricas: 'اختر المقاييس المراد مقارنتها:',
      reporteTitulo: 'مقارنة: {names}', reporteDescripcion: 'مقارنة تفصيلية لـ {count} لاعبين.',
    },
  },
  zh: {
    anchor: "'nav.comparaciones': '比较',",
    keys: {
      titulo: '球员对比', subtitulo: '选择2到3名球员进行对比',
      buscarPlaceholder: '输入球员姓名...', jugadorA: '球员A', jugadorB: '球员B', jugadorC: '球员C',
      tercerJugador: '+ 第3名球员', quitar: '移除',
      seleccionaAlMenos2: '至少选择2名球员',
      buscaYSelecciona: '使用上方的搜索框搜索并选择要对比的球员。',
      edad: '年龄', valorDeMercado: '市场价值', mejor: '最佳', masEconomico: '最便宜',
      radarTitulo: '雷达图对比', metricasClave: '关键指标', personalizado: '自定义',
      metricasImportantes: '该位置的重要指标', restablecer: '重置',
      cerrar: '关闭', personalizar: '自定义', seleccionaMetricas: '选择要对比的指标：',
      reporteTitulo: '对比：{names}', reporteDescripcion: '{count}名球员的详细对比。',
    },
  },
  ja: {
    anchor: "'nav.comparaciones': '比較',",
    keys: {
      titulo: '選手比較', subtitulo: '比較する選手を2〜3人選択',
      buscarPlaceholder: '選手名を入力...', jugadorA: '選手A', jugadorB: '選手B', jugadorC: '選手C',
      tercerJugador: '+ 3人目の選手', quitar: '削除',
      seleccionaAlMenos2: '少なくとも2人の選手を選択',
      buscaYSelecciona: '上の検索フィールドを使って比較したい選手を検索して選択してください。',
      edad: '年齢', valorDeMercado: '市場価値', mejor: '最高', masEconomico: '最も安い',
      radarTitulo: 'レーダー比較', metricasClave: '主要指標', personalizado: 'カスタム',
      metricasImportantes: 'このポジションで重要な指標', restablecer: 'リセット',
      cerrar: '閉じる', personalizar: 'カスタマイズ', seleccionaMetricas: '比較する指標を選択：',
      reporteTitulo: '比較：{names}', reporteDescripcion: '{count}人の選手の詳細比較。',
    },
  },
}

let count = 0
for (const [lang, { anchor, keys }] of Object.entries(blocks)) {
  if (!src.includes(anchor)) { console.error('ANCHOR NOT FOUND for', lang, ':', anchor); continue }
  const lines = Object.entries(keys).map(([k, v]) => `    'comparacion.${k}': ${JSON.stringify(v)},`).join('\n')
  src = src.replace(anchor, `${anchor}\n${lines}`)
  count++
}

fs.writeFileSync(path, src, 'utf8')
console.log('OK inserted for', count, 'languages')
