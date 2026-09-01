// Traducción del informe (sólo el informe, no la app). Idiomas: es (default), en,
// pt, ar (RTL), it, fr. Cubre textos fijos + nombres de métricas comunes de
// Wyscout; lo que no matchea queda en el idioma original del archivo.

import { normalizeForSearch } from '@/lib/search'

export type Lang = 'es' | 'en' | 'pt' | 'ar' | 'it' | 'fr'

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
]

const IDX: Record<Lang, number> = { es: 0, en: 1, pt: 2, ar: 3, it: 4, fr: 5 }

export function isRtl(lang: Lang): boolean {
  return lang === 'ar'
}

// Cada entrada: [es, en, pt, ar, it, fr]
type Six = [string, string, string, string, string, string]

const S: Record<string, Six> = {
  // Tabs
  tab_general: ['General', 'Overview', 'Geral', 'عام', 'Generale', 'Général'],
  tab_radar: ['Radar', 'Radar', 'Radar', 'رادار', 'Radar', 'Radar'],
  tab_bars: ['Barras', 'Bars', 'Barras', 'أعمدة', 'Barre', 'Barres'],
  tab_scatter: ['Dispersión', 'Scatter', 'Dispersão', 'مبعثر', 'Dispersione', 'Nuage'],
  tab_fisico: ['Físico', 'Physical', 'Físico', 'بدني', 'Fisico', 'Physique'],
  tab_video: ['Video', 'Video', 'Vídeo', 'فيديو', 'Video', 'Vidéo'],
  tab_carrera: ['Carrera', 'Career', 'Carreira', 'المسيرة', 'Carriera', 'Carrière'],
  tab_comparaciones: ['Comparaciones', 'Comparison', 'Comparações', 'مقارنات', 'Confronti', 'Comparaisons'],
  tab_evolutivas: ['Evolutivas', 'Trends', 'Evolutivas', 'التطور', 'Evolutive', 'Évolutives'],
  tab_impacto: ['Impacto', 'Impact', 'Impacto', 'التأثير', 'Impatto', 'Impact'],
  // Section titles
  t_radar: ['Radar comparativo', 'Comparative radar', 'Radar comparativo', 'رادار مقارن', 'Radar comparativo', 'Radar comparatif'],
  t_bars: ['Barras comparativas', 'Comparative bars', 'Barras comparativas', 'أعمدة مقارنة', 'Barre comparative', 'Barres comparatives'],
  t_scatter: ['Dispersión en el contexto', 'Distribution in context', 'Dispersão no contexto', 'التوزيع في السياق', 'Dispersione nel contesto', 'Dispersion en contexte'],
  t_phys: ['Datos físicos (GPS)', 'Physical data (GPS)', 'Dados físicos (GPS)', 'بيانات بدنية (GPS)', 'Dati fisici (GPS)', 'Données physiques (GPS)'],
  t_phys_intensity: ['Intensidad por partido (mts/min)', 'Intensity per match (m/min)', 'Intensidade por jogo (m/min)', 'الشدة لكل مباراة (م/د)', 'Intensità per partita (m/min)', 'Intensité par match (m/min)'],
  t_levelEvo: ['Evolución de nivel (Rating)', 'Level evolution (Rating)', 'Evolução de nível (Rating)', 'تطور المستوى (Rating)', 'Evoluzione del livello (Rating)', 'Évolution du niveau (Rating)'],
  t_marketEvo: ['Evolución de valor de mercado', 'Market value evolution', 'Evolução do valor de mercado', 'تطور القيمة السوقية', 'Evoluzione del valore di mercato', 'Évolution de la valeur marchande'],
  t_evolutivas: ['Métricas evolutivas', 'Metric trends', 'Métricas evolutivas', 'تطور المقاييس', 'Metriche evolutive', 'Évolution des métriques'],
  m_evolutivas_sub: ['Por partido · la línea punteada indica el promedio', 'Per match · the dashed line marks the average', 'Por jogo · a linha tracejada indica a média', 'لكل مباراة · الخط المتقطع يمثل المتوسط', 'Per partita · la linea tratteggiata indica la media', 'Par match · la ligne pointillée indique la moyenne'],
  t_last5: ['Últimos 5 partidos', 'Last 5 matches', 'Últimos 5 jogos', 'آخر 5 مباريات', 'Ultime 5 partite', '5 derniers matchs'],
  t_transfers: ['Historial de traspasos', 'Transfer history', 'Histórico de transferências', 'سجل الانتقالات', 'Storico dei trasferimenti', 'Historique des transferts'],
  t_comparables: ['Comparables', 'Comparables', 'Comparáveis', 'لاعبون مشابهون', 'Comparabili', 'Comparables'],
  t_detail: ['Detalle por métrica', 'Detail by metric', 'Detalhe por métrica', 'التفاصيل حسب المقياس', 'Dettaglio per metrica', 'Détail par métrique'],
  t_notes: ['Notas', 'Notes', 'Notas', 'ملاحظات', 'Note', 'Notes'],
  t_keyNumbers: ['Números clave', 'Key numbers', 'Números-chave', 'أرقام رئيسية', 'Numeri chiave', 'Chiffres clés'],
  t_mainStats: ['Estadísticas principales', 'Main stats', 'Estatísticas principais', 'إحصائيات رئيسية', 'Statistiche principali', 'Statistiques principales'],
  t_continuity: ['Continuidad', 'Playing time', 'Continuidade', 'الاستمرارية', 'Continuità', 'Temps de jeu'],
  t_injuries: ['Historial de lesiones', 'Injury history', 'Histórico de lesões', 'سجل الإصابات', 'Storico infortuni', 'Historique des blessures'],
  // Rail
  r_club: ['Club', 'Club', 'Clube', 'النادي', 'Club', 'Club'],
  r_league: ['Liga', 'League', 'Liga', 'الدوري', 'Campionato', 'Championnat'],
  r_age: ['Edad', 'Age', 'Idade', 'العمر', 'Età', 'Âge'],
  r_country: ['País', 'Country', 'País', 'البلد', 'Paese', 'Pays'],
  r_contract: ['Contrato', 'Contract', 'Contrato', 'العقد', 'Contratto', 'Contrat'],
  r_agent: ['Agencia', 'Agency', 'Agência', 'الوكالة', 'Agenzia', 'Agence'],
  r_marketValue: ['Valor de mercado', 'Market value', 'Valor de mercado', 'القيمة السوقية', 'Valore di mercato', 'Valeur marchande'],
  // Stats
  s_rating: ['Rating', 'Rating', 'Rating', 'التقييم', 'Rating', 'Note'],
  // Específico para la columna de "Últimos 5 partidos": es la nota de ESE
  // partido puntual (dato crudo de la API), no el Rating del jugador — se
  // usa una etiqueta distinta a s_rating para no confundirla con el rating
  // principal del informe.
  s_matchRating: ['Rating (partido)', 'Match rating', 'Rating (jogo)', 'تقييم المباراة', 'Rating (partita)', 'Note (match)'],
  s_pj: ['PJ', 'GP', 'J', 'مباريات', 'PG', 'MJ'],
  s_matches: ['Partidos', 'Matches', 'Jogos', 'مباريات', 'Partite', 'Matchs'],
  s_minutes: ['Minutos', 'Minutes', 'Minutos', 'دقائق', 'Minuti', 'Minutes'],
  s_goals: ['Goles', 'Goals', 'Gols', 'أهداف', 'Gol', 'Buts'],
  s_assists: ['Asistencias', 'Assists', 'Assistências', 'تمريرات حاسمة', 'Assist', 'Passes déc.'],
  s_starts: ['Titularidades', 'Starts', 'Titularidades', 'مباريات أساسية', 'Da titolare', 'Titularisations'],
  s_last5: ['Últimos 5', 'Last 5', 'Últimos 5', 'آخر 5', 'Ultime 5', '5 derniers'],
  s_last10: ['Últimos 10', 'Last 10', 'Últimos 10', 'آخر 10', 'Ultime 10', '10 derniers'],
  evo_match: ['Partido', 'Match', 'Jogo', 'مباراة', 'Partita', 'Match'],
  evo_week: ['Semanal', 'Weekly', 'Semanal', 'أسبوعي', 'Settimanale', 'Hebdo'],
  evo_month: ['Mensual', 'Monthly', 'Mensal', 'شهري', 'Mensile', 'Mensuel'],
  hint_rotate: [
    'Girá el teléfono o velo en desktop para verlo mejor',
    'Rotate your phone or open on desktop for a better view',
    'Gire o telefone ou veja no desktop para melhor visualização',
    'أدر هاتفك أو افتحه على الحاسوب لعرض أفضل',
    'Ruota il telefono o aprilo su desktop per una vista migliore',
    'Tourne ton téléphone ou ouvre-le sur ordinateur pour mieux voir',
  ],
  m_selectPlayerData: [
    'Elegí el jugador en la base de datos (paso 1) para ver su continuidad, evolución y lesiones.',
    'Pick the player in the database (step 1) to see playing time, evolution and injuries.',
    'Escolha o jogador na base (passo 1) para ver continuidade, evolução e lesões.',
    'اختر اللاعب من قاعدة البيانات (الخطوة 1) لعرض الاستمرارية والتطور والإصابات.',
    'Scegli il giocatore nel database (passo 1) per vedere continuità, evoluzione e infortuni.',
    'Choisis le joueur dans la base (étape 1) pour voir le temps de jeu, l’évolution et les blessures.',
  ],
  m_present: ['Actualidad', 'Present', 'Atual', 'الحاضر', 'Presente', 'Présent'],
  // Table headers
  h_opponent: ['Rival', 'Opponent', 'Adversário', 'الخصم', 'Avversario', 'Adversaire'],
  h_result: ['Resultado', 'Result', 'Resultado', 'النتيجة', 'Risultato', 'Résultat'],
  h_player: ['Jugador', 'Player', 'Jogador', 'اللاعب', 'Giocatore', 'Joueur'],
  h_delta: ['Delta', 'Delta', 'Delta', 'الفارق', 'Delta', 'Écart'],
  h_metric: ['Métrica', 'Metric', 'Métrica', 'المقياس', 'Metrica', 'Métrique'],
  // Legends
  l_thisPlayer: ['Este jugador', 'This player', 'Este jogador', 'هذا اللاعب', 'Questo giocatore', 'Ce joueur'],
  l_avgPosition: [
    'Promedio del resto de los jugadores en su posición',
    'Average of other players in his position',
    'Média dos outros jogadores na sua posição',
    'متوسط بقية اللاعبين في مركزه',
    'Media degli altri giocatori nel suo ruolo',
    'Moyenne des autres joueurs à son poste',
  ],
  l_otherPlayers: ['Otros jugadores', 'Other players', 'Outros jogadores', 'لاعبون آخرون', 'Altri giocatori', 'Autres joueurs'],
  l_best: ['Mejores', 'Best', 'Melhores', 'الأفضل', 'Migliori', 'Meilleurs'],
  // Help
  howToRead: ['Cómo leerlo', 'How to read it', 'Como ler', 'كيف تقرأه', 'Come leggerlo', 'Comment le lire'],
  standsOut: ['Destaca en', 'Stands out in', 'Destaca-se em', 'يتميز في', 'Spicca in', 'Se distingue en'],
  help_radar: [
    'Cada punta es una métrica. Cuanto más lejos del centro, mejor. La línea gris es un jugador promedio de su posición: lo verde por fuera es lo que hace mejor que el promedio.',
    'Each spoke is a metric. The farther from the center, the better. The grey line is an average player in his position: the green outside it is where he beats the average.',
    'Cada ponta é uma métrica. Quanto mais longe do centro, melhor. A linha cinza é um jogador médio da posição: o verde por fora é onde supera a média.',
    'كل رأس مقياس. كلما ابتعد عن المركز كان أفضل. الخط الرمادي لاعب متوسط في مركزه: الأخضر خارجه هو ما يتفوق فيه على المتوسط.',
    'Ogni punta è una metrica. Più lontano dal centro, meglio è. La linea grigia è un giocatore medio del ruolo: il verde oltre è dove supera la media.',
    'Chaque axe est une métrique. Plus c’est loin du centre, mieux c’est. La ligne grise est un joueur moyen à son poste : le vert au-delà, c’est là où il dépasse la moyenne.',
  ],
  help_bars: [
    'Cada barra es una métrica. El largo es el percentil: qué % de su posición supera (barra llena = mejor que casi todos). La marca gris es el promedio. A la derecha: el valor real y el puesto (N° de X) dentro del grupo.',
    'Each bar is a metric. The length is the percentile: the % of his position he beats (full bar = better than almost all). The grey mark is the average. On the right: the real value and rank (No. of X) within the group.',
    'Cada barra é uma métrica. O comprimento é o percentil: o % da posição que supera (barra cheia = melhor que quase todos). A marca cinza é a média. À direita: o valor real e a posição (Nº de X) no grupo.',
    'كل عمود مقياس. الطول هو النسبة المئوية: نسبة من يتفوق عليهم في مركزه (عمود ممتلئ = أفضل من الجميع تقريباً). العلامة الرمادية هي المتوسط. على اليمين: القيمة الفعلية والترتيب (رقم من X) ضمن المجموعة.',
    'Ogni barra è una metrica. La lunghezza è il percentile: la % del ruolo che supera (barra piena = meglio di quasi tutti). Il segno grigio è la media. A destra: il valore reale e la posizione (N° di X) nel gruppo.',
    'Chaque barre est une métrique. La longueur est le centile : le % de son poste qu’il dépasse (barre pleine = meilleur que presque tous). Le repère gris est la moyenne. À droite : la valeur réelle et le rang (n° sur X) dans le groupe.',
  ],
  help_scatter: [
    'Cada punto es un jugador; el verde es este jugador. La zona verde sombreada (con la flecha "Mejores") marca la esquina donde se combinan los mejores valores de las dos métricas.',
    'Each dot is a player; the green one is this player. The shaded green area (with the "Best" arrow) marks the corner where the best values of both metrics combine.',
    'Cada ponto é um jogador; o verde é este jogador. A área verde sombreada (com a seta "Melhores") marca o canto onde se combinam os melhores valores das duas métricas.',
    'كل نقطة لاعب؛ الأخضر هو هذا اللاعب. المنطقة الخضراء المظللة (بسهم "الأفضل") تحدد الزاوية التي تجتمع فيها أفضل قيم المقياسين.',
    'Ogni punto è un giocatore; quello verde è questo giocatore. L’area verde (con la freccia "Migliori") indica l’angolo dove si combinano i valori migliori delle due metriche.',
    'Chaque point est un joueur ; le vert est ce joueur. La zone verte (avec la flèche « Meilleurs ») marque le coin où se combinent les meilleures valeurs des deux métriques.',
  ],
  help_compar: [
    'El radar superpone a los jugadores (cada color, uno). Las tarjetas resumen cuántas métricas gana cada uno; la tabla muestra el ganador de cada métrica en verde.',
    'The radar overlays the players (one per color). The cards summarize how many metrics each one wins; the table shows the winner of each metric in green.',
    'O radar sobrepõe os jogadores (um por cor). Os cartões resumem quantas métricas cada um vence; a tabela mostra o vencedor de cada métrica em verde.',
    'الرادار يدمج اللاعبين (لون لكل واحد). البطاقات تلخّص عدد المقاييس التي يفوز بها كل لاعب؛ الجدول يظهر الفائز في كل مقياس بالأخضر.',
    'Il radar sovrappone i giocatori (un colore ciascuno). Le schede riassumono quante metriche vince ognuno; la tabella mostra il vincitore di ogni metrica in verde.',
    'Le radar superpose les joueurs (une couleur chacun). Les cartes résument combien de métriques chacun gagne ; le tableau montre le gagnant de chaque métrique en vert.',
  ],
  help_phys: [
    'Datos físicos promedio por partido tomados del GPS. La línea muestra la intensidad (metros por minuto) partido a partido.',
    'Average physical data per match from GPS. The line shows intensity (meters per minute) match by match.',
    'Dados físicos médios por jogo do GPS. A linha mostra a intensidade (metros por minuto) jogo a jogo.',
    'بيانات بدنية متوسطة لكل مباراة من GPS. الخط يظهر الشدة (أمتار في الدقيقة) مباراة بمباراة.',
    'Dati fisici medi per partita dal GPS. La linea mostra l’intensità (metri al minuto) partita per partita.',
    'Données physiques moyennes par match issues du GPS. La ligne montre l’intensité (mètres par minute) match par match.',
  ],
  help_level: [
    'Cada punto es el Rating del jugador en un partido, del más viejo al más nuevo. Muestra si su nivel viene en alza o en baja.',
    'Each point is the player’s Rating in a match, oldest to newest. It shows whether his level is trending up or down.',
    'Cada ponto é o Rating do jogador num jogo, do mais antigo ao mais recente. Mostra se o nível está subindo ou caindo.',
    'كل نقطة هي Rating للاعب في مباراة، من الأقدم للأحدث. تُظهر إن كان مستواه في صعود أو هبوط.',
    'Ogni punto è il Rating del giocatore in una partita, dal più vecchio al più recente. Mostra se il livello è in crescita o in calo.',
    'Chaque point est le Rating du joueur sur un match, du plus ancien au plus récent. Il montre si son niveau monte ou descend.',
  ],
  help_market: [
    'Valor de mercado (Transfermarkt) en el tiempo, en millones de euros.',
    'Market value (Transfermarkt) over time, in millions of euros.',
    'Valor de mercado (Transfermarkt) ao longo do tempo, em milhões de euros.',
    'القيمة السوقية (Transfermarkt) عبر الزمن، بملايين اليورو.',
    'Valore di mercato (Transfermarkt) nel tempo, in milioni di euro.',
    'Valeur marchande (Transfermarkt) dans le temps, en millions d’euros.',
  ],
  help_continuity: [
    'Resumen de minutos y titularidades. El percentil compara sus minutos con los jugadores de su posición en su liga.',
    'Summary of minutes and starts. The percentile compares his minutes with players in his position in his league.',
    'Resumo de minutos e titularidades. O percentil compara seus minutos com jogadores da sua posição na sua liga.',
    'ملخص الدقائق والمباريات الأساسية. النسبة تقارن دقائقه بلاعبي مركزه في دوريه.',
    'Riepilogo di minuti e presenze da titolare. Il percentile confronta i suoi minuti con i giocatori del suo ruolo nel suo campionato.',
    'Résumé des minutes et titularisations. Le centile compare ses minutes aux joueurs de son poste dans son championnat.',
  ],
  // Misc
  m_metricsWon: ['métricas ganadas', 'metrics won', 'métricas vencidas', 'مقاييس رابحة', 'metriche vinte', 'métriques gagnées'],
  m_of: ['de', 'of', 'de', 'من', 'di', 'sur'],
  m_scoutingReport: ['Informe de Scouting', 'Scouting Report', 'Relatório de Scouting', 'تقرير كشفي', 'Report di Scouting', 'Rapport de Scouting'],
  m_noVideo: ['Sin video cargado.', 'No video added.', 'Sem vídeo.', 'لا يوجد فيديو.', 'Nessun video.', 'Aucune vidéo.'],
  v_youtube: ['Ver en YouTube', 'Watch on YouTube', 'Ver no YouTube', 'شاهد على يوتيوب', 'Guarda su YouTube', 'Voir sur YouTube'],
  v_watch: ['Ver video', 'Watch video', 'Ver vídeo', 'شاهد الفيديو', 'Guarda il video', 'Voir la vidéo'],
  m_noInjuries: ['Sin lesiones registradas.', 'No injuries on record.', 'Sem lesões registradas.', 'لا إصابات مسجلة.', 'Nessun infortunio registrato.', 'Aucune blessure enregistrée.'],
  m_noComparables: ['Sin comparables cargados.', 'No comparables added.', 'Sem comparáveis.', 'لا يوجد لاعبون مشابهون.', 'Nessun comparabile.', 'Aucun comparable.'],
  m_noMatches: ['Sin partidos cargados.', 'No matches added.', 'Sem jogos.', 'لا مباريات.', 'Nessuna partita.', 'Aucun match.'],
  m_noTransfers: ['Sin traspasos registrados', 'No transfers on record', 'Sem transferências registradas', 'لا انتقالات مسجلة', 'Nessun trasferimento registrato', 'Aucun transfert enregistré'],
  m_ratingGauge: ['Rating', 'Rating', 'Rating', 'التقييم', 'Rating', 'Note'],
  m_avgLine: ['línea = promedio', 'line = average', 'linha = média', 'الخط = المتوسط', 'linea = media', 'ligne = moyenne'],
  m_ratingVsPos: [
    'Mejor que el {pct}% de {pos} en {league}',
    'Better than {pct}% of {pos} in {league}',
    'Melhor que {pct}% dos {pos} na {league}',
    'أفضل من {pct}% من {pos} في {league}',
    'Meglio del {pct}% dei {pos} in {league}',
    'Meilleur que {pct}% des {pos} en {league}',
  ],
  m_playedMoreThan: [
    'Jugó más minutos que el {pct}% del resto de los jugadores',
    'Played more minutes than {pct}% of the other players',
    'Jogou mais minutos que {pct}% dos outros jogadores',
    'لعب دقائق أكثر من {pct}% من بقية اللاعبين',
    'Ha giocato più minuti del {pct}% degli altri giocatori',
    'A joué plus de minutes que {pct}% des autres joueurs',
  ],
  m_last5Played: [
    'Jugó {n} de los últimos {t} partidos',
    'Played {n} of the last {t} matches',
    'Jogou {n} dos últimos {t} jogos',
    'لعب {n} من آخر {t} مباريات',
    'Ha giocato {n} delle ultime {t} partite',
    'A joué {n} des {t} derniers matchs',
  ],
  m_avg: ['promedio', 'average', 'média', 'المتوسط', 'media', 'moyenne'],

  // ── Impacto: títulos ──
  imp_since: ['Desde su llegada — {date}', 'Since joining — {date}', 'Desde a sua chegada — {date}', 'منذ انضمامه — {date}', "Dall'arrivo — {date}", 'Depuis son arrivée — {date}'],
  imp_season: ['Temporada actual', 'Current season', 'Temporada atual', 'الموسم الحالي', 'Stagione in corso', 'Saison en cours'],
  imp_last10: ['Últimos 10 partidos', 'Last 10 matches', 'Últimos 10 jogos', 'آخر 10 مباريات', 'Ultime 10 partite', '10 derniers matchs'],
  imp_range: ['{from} a {to}', '{from} to {to}', '{from} a {to}', '{from} إلى {to}', '{from} a {to}', '{from} au {to}'],
  imp_g_continuidad: ['Continuidad', 'Availability', 'Continuidade', 'الاستمرارية', 'Continuità', 'Continuité'],
  imp_g_ofensivo: ['Peso ofensivo', 'Attacking weight', 'Peso ofensivo', 'الوزن الهجومي', 'Peso offensivo', 'Poids offensif'],
  imp_g_plantel: ['Su lugar en el plantel', 'His place in the squad', 'O seu lugar no plantel', 'مكانته في الفريق', 'Il suo posto in rosa', 'Sa place dans l’effectif'],
  imp_g_rendimiento: ['Rendimiento', 'Performance', 'Rendimento', 'الأداء', 'Rendimento', 'Performance'],
  imp_g_resultados: ['Impacto en resultados', 'Impact on results', 'Impacto nos resultados', 'التأثير على النتائج', 'Impatto sui risultati', 'Impact sur les résultats'],
  imp_note_coverage: [
    'Datos de las competencias con cobertura estadística.',
    'Data from competitions with statistical coverage.',
    'Dados das competições com cobertura estatística.',
    'بيانات من المسابقات ذات التغطية الإحصائية.',
    'Dati delle competizioni con copertura statistica.',
    'Données des compétitions avec couverture statistique.',
  ],

  // ── Impacto: tarjetas ──
  imp_tile_pj: ['Partidos jugados', 'Matches played', 'Jogos disputados', 'المباريات المُلعوبة', 'Partite giocate', 'Matchs joués'],
  imp_tile_ga: ['{goals} goles · {assists} asistencias', '{goals} goals · {assists} assists', '{goals} gols · {assists} assistências', '{goals} أهداف · {assists} تمريرات حاسمة', '{goals} gol · {assists} assist', '{goals} buts · {assists} passes décisives'],
  imp_tile_share: ['De los goles del equipo', 'Of the team’s goals', 'Dos gols da equipa', 'من أهداف الفريق', 'Dei gol della squadra', 'Des buts de l’équipe'],
  imp_tile_score: ['Rating promedio', 'Average Rating', 'Rating médio', 'متوسط Rating', 'Rating medio', 'Rating moyen'],

  // ── Impacto: continuidad ──
  imp_cont_pj_all: ['Jugó los {teamMatches} partidos oficiales del equipo: disponibilidad total.', 'Played all {teamMatches} official matches: fully available.', 'Jogou os {teamMatches} jogos oficiais da equipa: disponibilidade total.', 'لعب جميع مباريات الفريق الرسمية البالغة {teamMatches}: جاهزية تامة.', 'Ha giocato tutte le {teamMatches} partite ufficiali: sempre disponibile.', 'A joué les {teamMatches} matchs officiels de l’équipe : disponibilité totale.'],
  imp_cont_pj: ['Disputó {played} de los {teamMatches} partidos oficiales del equipo ({pct}%).', 'Played {played} of the team’s {teamMatches} official matches ({pct}%).', 'Disputou {played} dos {teamMatches} jogos oficiais da equipa ({pct}%).', 'خاض {played} من أصل {teamMatches} مباراة رسمية ({pct}%).', 'Ha disputato {played} delle {teamMatches} partite ufficiali ({pct}%).', 'A disputé {played} des {teamMatches} matchs officiels ({pct}%).'],
  imp_cont_titulares: ['Fue titular en {starts} de esos {played} partidos ({pct}%).', 'Started {starts} of those {played} matches ({pct}%).', 'Foi titular em {starts} desses {played} jogos ({pct}%).', 'كان أساسياً في {starts} من تلك المباريات الـ{played} ({pct}%).', 'Titolare in {starts} di quelle {played} partite ({pct}%).', 'Titulaire lors de {starts} de ces {played} matchs ({pct}%).'],
  imp_cont_minutos: ['Acumuló {minutes} minutos, el {pct}% de los disponibles.', 'Logged {minutes} minutes, {pct}% of those available.', 'Somou {minutes} minutos, {pct}% dos disponíveis.', 'جمع {minutes} دقيقة، أي {pct}% من الدقائق المتاحة.', 'Ha accumulato {minutes} minuti, il {pct}% di quelli disponibili.', 'A cumulé {minutes} minutes, soit {pct}% du total possible.'],
  imp_cont_pj_all_one: ['Jugó el único partido oficial del equipo.', 'Played the team’s only official match.', 'Jogou o único jogo oficial da equipa.', 'لعب المباراة الرسمية الوحيدة للفريق.', 'Ha giocato l’unica partita ufficiale della squadra.', 'A joué l’unique match officiel de l’équipe.'],
  imp_cont_lesiones_one: ['Se perdió un partido por lesión.', 'Missed one match through injury.', 'Falhou um jogo por lesão.', 'غاب عن مباراة واحدة بسبب الإصابة.', 'Ha saltato una partita per infortunio.', 'A manqué un match sur blessure.'],
  imp_cont_lesiones: ['Se perdió {missed} partidos por lesión.', 'Missed {missed} matches through injury.', 'Falhou {missed} jogos por lesão.', 'غاب عن {missed} مباريات بسبب الإصابة.', 'Ha saltato {missed} partite per infortunio.', 'A manqué {missed} matchs sur blessure.'],

  // ── Impacto: peso ofensivo ──
  imp_ofe_participaciones: ['Sumó {goals} goles y {assists} asistencias: {ga} participaciones directas en gol.', 'Scored {goals} and assisted {assists}: {ga} direct goal contributions.', 'Somou {goals} gols e {assists} assistências: {ga} participações diretas.', 'سجل {goals} أهداف وصنع {assists}: {ga} مساهمة تهديفية مباشرة.', 'Ha realizzato {goals} gol e {assists} assist: {ga} partecipazioni dirette.', 'A inscrit {goals} buts et délivré {assists} passes décisives : {ga} contributions directes.'],
  imp_ofe_share_strong: ['Participó en {ga} de los {teamGoals} goles del equipo: más de uno de cada cuatro ({pct}%).', 'Was involved in {ga} of the team’s {teamGoals} goals: more than one in four ({pct}%).', 'Participou em {ga} dos {teamGoals} gols da equipa: mais de um em cada quatro ({pct}%).', 'شارك في {ga} من أصل {teamGoals} هدفاً للفريق: أكثر من هدف من كل أربعة ({pct}%).', 'Ha partecipato a {ga} dei {teamGoals} gol della squadra: più di uno su quattro ({pct}%).', 'A participé à {ga} des {teamGoals} buts de l’équipe : plus d’un sur quatre ({pct}%).'],
  imp_ofe_share_third: ['Participó en {ga} de los {teamGoals} goles del equipo: uno de cada tres ({pct}%).', 'Was involved in {ga} of the team’s {teamGoals} goals: one in three ({pct}%).', 'Participou em {ga} dos {teamGoals} gols da equipa: um em cada três ({pct}%).', 'شارك في {ga} من أصل {teamGoals} هدفاً للفريق: هدف من كل ثلاثة ({pct}%).', 'Ha partecipato a {ga} dei {teamGoals} gol della squadra: uno su tre ({pct}%).', 'A participé à {ga} des {teamGoals} buts de l’équipe : un sur trois ({pct}%).'],
  imp_ofe_share: ['Participó en {ga} de los {teamGoals} goles del equipo ({pct}%).', 'Was involved in {ga} of the team’s {teamGoals} goals ({pct}%).', 'Participou em {ga} dos {teamGoals} gols da equipa ({pct}%).', 'شارك في {ga} من أصل {teamGoals} هدفاً للفريق ({pct}%).', 'Ha partecipato a {ga} dei {teamGoals} gol della squadra ({pct}%).', 'A participé à {ga} des {teamGoals} buts de l’équipe ({pct}%).'],
  imp_ofe_promedio: ['Promedia {perMatch} participaciones de gol por partido ({goalsPerMatch} goles y {assistsPerMatch} asistencias).', 'Averages {perMatch} goal contributions per match ({goalsPerMatch} goals and {assistsPerMatch} assists).', 'Média de {perMatch} participações por jogo ({goalsPerMatch} gols e {assistsPerMatch} assistências).', 'بمعدل {perMatch} مساهمة تهديفية لكل مباراة ({goalsPerMatch} أهداف و{assistsPerMatch} تمريرة حاسمة).', 'Media di {perMatch} partecipazioni a partita ({goalsPerMatch} gol e {assistsPerMatch} assist).', 'Moyenne de {perMatch} contributions par match ({goalsPerMatch} buts et {assistsPerMatch} passes).'],
  imp_ofe_cada_one: ['Un gol o asistencia por partido.', 'A goal or assist every match.', 'Um gol ou assistência por jogo.', 'هدف أو تمريرة حاسمة في كل مباراة.', 'Un gol o assist a partita.', 'Un but ou une passe décisive par match.'],
  imp_ofe_cada: ['Un gol o asistencia cada {every} partidos.', 'A goal or assist every {every} matches.', 'Um gol ou assistência a cada {every} jogos.', 'هدف أو تمريرة حاسمة كل {every} مباراة.', 'Un gol o assist ogni {every} partite.', 'Un but ou une passe décisive tous les {every} matchs.'],

  // ── Impacto: plantel ──
  imp_plantel_first: ['Es el que más {metric} del plantel: {value} de {teamTotal} ({pct}% del total).', 'He leads the squad in {metric}: {value} of {teamTotal} ({pct}% of the total).', 'É o que mais {metric} do plantel: {value} de {teamTotal} ({pct}% do total).', 'هو الأول في الفريق في {metric}: {value} من {teamTotal} ({pct}% من الإجمالي).', 'È il primo della rosa per {metric}: {value} su {teamTotal} ({pct}% del totale).', 'Il est le premier de l’effectif en {metric} : {value} sur {teamTotal} ({pct}% du total).'],
  imp_plantel_rank: ['{rank}º del plantel en {metric}: {value} de {teamTotal} ({pct}% del total).', '{rank}th in the squad in {metric}: {value} of {teamTotal} ({pct}% of the total).', '{rank}º do plantel em {metric}: {value} de {teamTotal} ({pct}% do total).', 'الـ{rank} في الفريق في {metric}: {value} من {teamTotal} ({pct}% من الإجمالي).', '{rank}º della rosa per {metric}: {value} su {teamTotal} ({pct}% del totale).', '{rank}e de l’effectif en {metric} : {value} sur {teamTotal} ({pct}% du total).'],
  imp_plantel_rate_first: ['{metric} el {value}% {what}: el mejor entre los {pool} jugadores con más de {minMinutes} minutos.', '{metric} {value}% {what}: the best among the {pool} players with over {minMinutes} minutes.', '{metric} {value}% {what}: o melhor entre os {pool} jogadores com mais de {minMinutes} minutos.', '{metric} {value}% {what}: الأفضل بين {pool} لاعبين تجاوزوا {minMinutes} دقيقة.', '{metric} il {value}% {what}: il migliore tra i {pool} giocatori con più di {minMinutes} minuti.', '{metric} {value}% {what} : le meilleur parmi les {pool} joueurs de plus de {minMinutes} minutes.'],
  imp_plantel_rate: ['{metric} el {value}% {what}: {rank}º entre los {pool} jugadores con más de {minMinutes} minutos.', '{metric} {value}% {what}: {rank}th among the {pool} players with over {minMinutes} minutes.', '{metric} {value}% {what}: {rank}º entre os {pool} jogadores com mais de {minMinutes} minutos.', '{metric} {value}% {what}: الـ{rank} بين {pool} لاعبين تجاوزوا {minMinutes} دقيقة.', '{metric} il {value}% {what}: {rank}º tra i {pool} giocatori con più di {minMinutes} minuti.', '{metric} {value}% {what} : {rank}e parmi les {pool} joueurs de plus de {minMinutes} minutes.'],
  imp_plantel_score_first: ['Es el mejor Rating del plantel ({value}) entre los {pool} jugadores con más de {minMinutes} minutos.', 'He has the best Rating in the squad ({value}) among the {pool} players with over {minMinutes} minutes.', 'Tem o melhor Rating do plantel ({value}) entre os {pool} jogadores com mais de {minMinutes} minutos.', 'يمتلك أفضل Rating في الفريق ({value}) بين {pool} لاعبين تجاوزوا {minMinutes} دقيقة.', 'Ha il miglior Rating della rosa ({value}) tra i {pool} giocatori con più di {minMinutes} minuti.', 'Il a le meilleur Rating de l’effectif ({value}) parmi les {pool} joueurs de plus de {minMinutes} minutes.'],
  imp_plantel_score: ['{rank}º Rating del plantel ({value}) entre los {pool} jugadores con más de {minMinutes} minutos.', '{rank}th best Rating in the squad ({value}) among the {pool} players with over {minMinutes} minutes.', '{rank}º melhor Rating do plantel ({value}) entre os {pool} jogadores com mais de {minMinutes} minutos.', 'الـ{rank} في Rating داخل الفريق ({value}) بين {pool} لاعبين تجاوزوا {minMinutes} دقيقة.', '{rank}º Rating della rosa ({value}) tra i {pool} giocatori con più di {minMinutes} minuti.', '{rank}e Rating de l’effectif ({value}) parmi les {pool} joueurs de plus de {minMinutes} minutes.'],
  imp_plantel_position: ['{rank}º entre los {pool} {position} del plantel.', '{rank}th among the squad’s {pool} {position}.', '{rank}º entre os {pool} {position} do plantel.', 'الـ{rank} بين {pool} من {position} في الفريق.', '{rank}º tra i {pool} {position} della rosa.', '{rank}e parmi les {pool} {position} de l’effectif.'],
  // Dos juegos de etiquetas: frase verbal para "el que más X del plantel" y
  // sustantivo para "Nº del plantel en X". Mezclarlas da "5º del plantel en goles convirtió".
  imp_m_goals: ['goles convirtió', 'goals scored', 'gols marcou', 'الأهداف', 'gol', 'buts'],
  imp_m_assists: ['asistencias dio', 'assists', 'assistências deu', 'التمريرات الحاسمة', 'assist', 'passes décisives'],
  imp_m_ga: ['participaciones de gol tuvo', 'goal contributions', 'participações teve', 'المساهمات التهديفية', 'partecipazioni', 'contributions'],
  imp_m_keyPasses: ['pases clave dio', 'key passes', 'passes decisivos deu', 'التمريرات المفتاحية', 'passaggi chiave', 'passes clés'],
  imp_m_minutes: ['minutos jugó', 'minutes played', 'minutos jogou', 'الدقائق', 'minuti', 'minutes'],
  imp_n_goals: ['goles', 'goals', 'gols', 'الأهداف', 'gol', 'buts'],
  imp_n_assists: ['asistencias', 'assists', 'assistências', 'التمريرات الحاسمة', 'assist', 'passes décisives'],
  imp_n_ga: ['participaciones de gol', 'goal contributions', 'participações de gol', 'المساهمات التهديفية', 'partecipazioni', 'contributions'],
  imp_n_keyPasses: ['pases clave', 'key passes', 'passes decisivos', 'التمريرات المفتاحية', 'passaggi chiave', 'passes clés'],
  imp_n_minutes: ['minutos', 'minutes', 'minutos', 'الدقائق', 'minuti', 'minutes'],
  imp_m_duelPct: ['Gana', 'Wins', 'Ganha', 'يفوز بـ', 'Vince', 'Remporte'],
  imp_m_duelPct_suffix: ['de sus duelos', 'of his duels', 'dos seus duelos', 'من ثنائياته', 'dei suoi duelli', 'de ses duels'],
  imp_m_dribblePct: ['Completa', 'Completes', 'Completa', 'ينجح في', 'Completa', 'Réussit'],
  imp_m_dribblePct_suffix: ['de sus regates', 'of his dribbles', 'dos seus dribles', 'من مراوغاته', 'dei suoi dribbling', 'de ses dribbles'],

  // ── Impacto: rendimiento ──
  imp_rend_promedio: ['Promedia {avg} de Rating en {matches} partidos.', 'Averages {avg} Rating across {matches} matches.', 'Média de {avg} de Rating em {matches} jogos.', 'بمعدل {avg} في Rating خلال {matches} مباراة.', 'Media di {avg} di Rating in {matches} partite.', 'Moyenne de {avg} de Rating sur {matches} matchs.'],
  imp_rend_mejor: ['Su mejor partido del período: {best}.', 'His best match of the period: {best}.', 'O seu melhor jogo do período: {best}.', 'أفضل مباراة له في الفترة: {best}.', 'La sua miglior partita del periodo: {best}.', 'Son meilleur match de la période : {best}.'],
  imp_rend_up: ['Viene en alza: {recent} de promedio en los últimos partidos contra {previous} antes.', 'Trending up: {recent} on average in recent matches against {previous} before.', 'Em alta: {recent} de média nos últimos jogos contra {previous} antes.', 'في تصاعد: {recent} كمعدل في المباريات الأخيرة مقابل {previous} قبلها.', 'In crescita: {recent} di media nelle ultime partite contro {previous} prima.', 'En hausse : {recent} de moyenne sur les derniers matchs contre {previous} avant.'],
  imp_rend_down: ['Viene en baja: {recent} de promedio en los últimos partidos contra {previous} antes.', 'Trending down: {recent} on average in recent matches against {previous} before.', 'Em baixa: {recent} de média nos últimos jogos contra {previous} antes.', 'في تراجع: {recent} كمعدل في المباريات الأخيرة مقابل {previous} قبلها.', 'In calo: {recent} di media nelle ultime partite contro {previous} prima.', 'En baisse : {recent} de moyenne sur les derniers matchs contre {previous} avant.'],
  imp_rend_flat: ['Rendimiento sostenido: {recent} de promedio en los últimos partidos contra {previous} antes.', 'Steady output: {recent} on average in recent matches against {previous} before.', 'Rendimento sustentado: {recent} de média nos últimos jogos contra {previous} antes.', 'أداء ثابت: {recent} كمعدل في المباريات الأخيرة مقابل {previous} قبلها.', 'Rendimento costante: {recent} di media nelle ultime partite contro {previous} prima.', 'Rendement constant : {recent} de moyenne sur les derniers matchs contre {previous} avant.'],
  imp_rend_sobre: ['Superó su propio promedio en {above} de {matches} partidos ({pct}%).', 'Beat his own average in {above} of {matches} matches ({pct}%).', 'Superou a sua média em {above} de {matches} jogos ({pct}%).', 'تجاوز معدله الشخصي في {above} من {matches} مباراة ({pct}%).', 'Ha superato la propria media in {above} partite su {matches} ({pct}%).', 'A dépassé sa propre moyenne dans {above} des {matches} matchs ({pct}%).'],
  imp_rend_percentil: ['Su Rating lo ubica mejor que el {pct}% de los jugadores de su posición.', 'His Rating places him above {pct}% of players in his position.', 'O seu Rating coloca-o acima de {pct}% dos jogadores da sua posição.', 'يضعه Rating أفضل من {pct}% من لاعبي مركزه.', 'Il suo Rating lo colloca meglio del {pct}% dei giocatori nel suo ruolo.', 'Son Rating le place devant {pct}% des joueurs à son poste.'],

  // ── Impacto: resultados ──
  imp_res_record: ['Con él en cancha el equipo ganó {wins}, empató {draws} y perdió {losses}.', 'With him on the pitch the team won {wins}, drew {draws} and lost {losses}.', 'Com ele em campo a equipa venceu {wins}, empatou {draws} e perdeu {losses}.', 'بوجوده في الملعب فاز الفريق {wins} وتعادل {draws} وخسر {losses}.', 'Con lui in campo la squadra ha vinto {wins}, pareggiato {draws} e perso {losses}.', 'Avec lui sur le terrain, l’équipe a gagné {wins}, fait {draws} nuls et perdu {losses}.'],
  imp_res_conSinEl: ['Con él en cancha el equipo saca {withPpg} puntos por partido; sin él, {withoutPpg}.', 'With him the team takes {withPpg} points per match; without him, {withoutPpg}.', 'Com ele a equipa soma {withPpg} pontos por jogo; sem ele, {withoutPpg}.', 'بوجوده يحصد الفريق {withPpg} نقطة في المباراة؛ وبدونه {withoutPpg}.', 'Con lui la squadra ottiene {withPpg} punti a partita; senza di lui, {withoutPpg}.', 'Avec lui l’équipe prend {withPpg} points par match ; sans lui, {withoutPpg}.'],
}

/** Interpolación simple de {var}. */
function interp(tpl: string, vars?: Record<string, string | number>): string {
  if (!vars) return tpl
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`))
}

/** ¿Existe la clave? Sirve para probar variantes (p. ej. singulares en `_one`). */
export function hasKey(key: string): boolean {
  return key in S
}

/** Traduce una clave fija del informe al idioma dado (fallback: es). */
export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const row = S[key]
  if (!row) return key
  return interp(row[IDX[lang]] || row[0], vars)
}

// ── Métricas comunes de Wyscout ─────────────────────────────────────────────
// Keyed por nombre normalizado en español (sin acentos, minúscula).

const METRICS: Record<string, Six> = {
  edad: ['Edad', 'Age', 'Idade', 'العمر', 'Età', 'Âge'],
  altura: ['Altura', 'Height', 'Altura', 'الطول', 'Altezza', 'Taille'],
  'partidos jugados': ['Partidos jugados', 'Matches played', 'Jogos disputados', 'المباريات', 'Partite giocate', 'Matchs joués'],
  'minutos jugados': ['Minutos jugados', 'Minutes played', 'Minutos jogados', 'الدقائق', 'Minuti giocati', 'Minutes jouées'],
  goles: ['Goles', 'Goals', 'Gols', 'الأهداف', 'Gol', 'Buts'],
  'goles/90': ['Goles/90', 'Goals/90', 'Gols/90', 'أهداف/90', 'Gol/90', 'Buts/90'],
  xg: ['xG', 'xG', 'xG', 'xG', 'xG', 'xG'],
  'xg/90': ['xG/90', 'xG/90', 'xG/90', 'xG/90', 'xG/90', 'xG/90'],
  asistencias: ['Asistencias', 'Assists', 'Assistências', 'التمريرات الحاسمة', 'Assist', 'Passes décisives'],
  'asistencias/90': ['Asistencias/90', 'Assists/90', 'Assistências/90', 'تمريرات حاسمة/90', 'Assist/90', 'Passes déc./90'],
  xa: ['xA', 'xA', 'xA', 'xA', 'xA', 'xA'],
  'xa/90': ['xA/90', 'xA/90', 'xA/90', 'xA/90', 'xA/90', 'xA/90'],
  'duelos /90': ['Duelos/90', 'Duels/90', 'Duelos/90', 'مواجهات/90', 'Duelli/90', 'Duels/90'],
  'duelos ganados, %': ['Duelos ganados %', 'Duels won %', 'Duelos ganhos %', '% المواجهات المكسوبة', 'Duelli vinti %', 'Duels gagnés %'],
  'acciones defensivas realizadas/90': ['Acciones defensivas/90', 'Defensive actions/90', 'Ações defensivas/90', 'أعمال دفاعية/90', 'Azioni difensive/90', 'Actions défensives/90'],
  'duelos defensivos /90': ['Duelos defensivos/90', 'Defensive duels/90', 'Duelos defensivos/90', 'مواجهات دفاعية/90', 'Duelli difensivi/90', 'Duels défensifs/90'],
  'duelos defensivos ganados, %': ['Duelos defensivos ganados %', 'Defensive duels won %', 'Duelos defensivos ganhos %', '% المواجهات الدفاعية المكسوبة', 'Duelli difensivi vinti %', 'Duels défensifs gagnés %'],
  'duelos aereos en los 90': ['Duelos aéreos/90', 'Aerial duels/90', 'Duelos aéreos/90', 'مواجهات هوائية/90', 'Duelli aerei/90', 'Duels aériens/90'],
  'duelos aereos ganados, %': ['Duelos aéreos ganados %', 'Aerial duels won %', 'Duelos aéreos ganhos %', '% المواجهات الهوائية المكسوبة', 'Duelli aerei vinti %', 'Duels aériens gagnés %'],
  'entradas /90': ['Entradas/90', 'Tackles/90', 'Desarmes/90', 'التدخلات/90', 'Contrasti/90', 'Tacles/90'],
  'interceptaciones/90': ['Interceptaciones/90', 'Interceptions/90', 'Interceptações/90', 'الاعتراضات/90', 'Intercetti/90', 'Interceptions/90'],
  'faltas/90': ['Faltas/90', 'Fouls/90', 'Faltas/90', 'الأخطاء/90', 'Falli/90', 'Fautes/90'],
  'faltas recibidas /90': ['Faltas recibidas/90', 'Fouls drawn/90', 'Faltas sofridas/90', 'أخطاء عليه/90', 'Falli subiti/90', 'Fautes subies/90'],
  'remates': ['Remates', 'Shots', 'Finalizações', 'التسديدات', 'Tiri', 'Tirs'],
  'remates /90': ['Remates/90', 'Shots/90', 'Finalizações/90', 'تسديدات/90', 'Tiri/90', 'Tirs/90'],
  'tiros a la porteria, %': ['Tiros a puerta %', 'Shots on target %', 'Chutes no gol %', '% التسديدات على المرمى', 'Tiri in porta %', 'Tirs cadrés %'],
  'regates /90': ['Regates/90', 'Dribbles/90', 'Dribles/90', 'المراوغات/90', 'Dribbling/90', 'Dribbles/90'],
  'regates completados, %': ['Regates completados %', 'Dribbles completed %', 'Dribles completos %', '% المراوغات الناجحة', 'Dribbling riusciti %', 'Dribbles réussis %'],
  'centros /90': ['Centros/90', 'Crosses/90', 'Cruzamentos/90', 'العرضيات/90', 'Cross/90', 'Centres/90'],
  'precision centros, %': ['Precisión centros %', 'Cross accuracy %', 'Precisão cruzamentos %', '% دقة العرضيات', 'Precisione cross %', 'Précision centres %'],
  'pases recibidos /90': ['Pases recibidos/90', 'Passes received/90', 'Passes recebidos/90', 'التمريرات المستلمة/90', 'Passaggi ricevuti/90', 'Passes reçues/90'],
  'pases largos recibidos/90': ['Pases largos recibidos/90', 'Long passes received/90', 'Passes longos recebidos/90', 'تمريرات طويلة مستلمة/90', 'Passaggi lunghi ricevuti/90', 'Longues passes reçues/90'],
  'acciones de ataque exitosas/90': ['Acciones de ataque exitosas/90', 'Successful attacking actions/90', 'Ações ofensivas bem-sucedidas/90', 'أعمال هجومية ناجحة/90', 'Azioni offensive riuscite/90', 'Actions offensives réussies/90'],
  'duelos atacantes/90': ['Duelos ofensivos/90', 'Offensive duels/90', 'Duelos ofensivos/90', 'مواجهات هجومية/90', 'Duelli offensivi/90', 'Duels offensifs/90'],
  'duelos atacantes ganados, %': ['Duelos ofensivos ganados %', 'Offensive duels won %', 'Duelos ofensivos ganhos %', '% المواجهات الهجومية المكسوبة', 'Duelli offensivi vinti %', 'Duels offensifs gagnés %'],
  'toques en el area de penalti/90': ['Toques en el área/90', 'Touches in box/90', 'Toques na área/90', 'لمسات في المنطقة/90', 'Tocchi in area/90', 'Touches dans la surface/90'],
  'carreras en progresion/90': ['Carreras en progresión/90', 'Progressive runs/90', 'Corridas progressivas/90', 'اختراقات تقدمية/90', 'Corse progressive/90', 'Courses progressives/90'],
  'goles de cabeza': ['Goles de cabeza', 'Headed goals', 'Gols de cabeça', 'أهداف رأسية', 'Gol di testa', 'Buts de la tête'],
  'goles, excepto los penaltis/90': ['Goles sin penales/90', 'Non-penalty goals/90', 'Gols sem pênaltis/90', 'أهداف بدون ركلات جزاء/90', 'Gol su azione/90', 'Buts hors penalty/90'],
}

// Índice con las claves ya normalizadas (igual que el input), para matchear bien
// aunque las claves del mapa tengan comas/acentos/mayúsculas.
const METRICS_NORM: Record<string, Six> = Object.fromEntries(
  Object.entries(METRICS).map(([k, v]) => [normalizeForSearch(k), v]),
)

/** Traduce un nombre de métrica conocido; si no matchea, devuelve el original. */
export function translateMetric(label: string, lang: Lang): string {
  if (lang === 'es') return label
  const row = METRICS_NORM[normalizeForSearch(label)]
  return row ? row[IDX[lang]] || label : label
}

// ── Tipos de lesión (API-Football /sidelined) ──────────────────────────────
// La API devuelve el tipo en inglés (a menudo genérico: "Injury"). Traducimos por
// palabra clave (de lo más específico a lo genérico); lo que no matchea se deja igual.
const INJURY_RULES: [string[], Six][] = [
  [['knee'], ['Lesión de rodilla', 'Knee injury', 'Lesão no joelho', 'إصابة في الركبة', 'Infortunio al ginocchio', 'Blessure au genou']],
  [['ankle'], ['Lesión de tobillo', 'Ankle injury', 'Lesão no tornozelo', 'إصابة في الكاحل', 'Infortunio alla caviglia', 'Blessure à la cheville']],
  [['hamstring'], ['Isquiotibiales', 'Hamstring injury', 'Lesão nos isquiotibiais', 'إصابة في أوتار الركبة', 'Infortunio agli ischiocrurali', 'Blessure aux ischio-jambiers']],
  [['thigh'], ['Lesión en el muslo', 'Thigh injury', 'Lesão na coxa', 'إصابة في الفخذ', 'Infortunio alla coscia', 'Blessure à la cuisse']],
  [['groin', 'pubis'], ['Lesión en el pubis', 'Groin injury', 'Lesão na virilha', 'إصابة في المغبن', 'Infortunio all’inguine', 'Blessure à l’aine']],
  [['calf'], ['Lesión en el gemelo', 'Calf injury', 'Lesão na panturrilha', 'إصابة في السمانة', 'Infortunio al polpaccio', 'Blessure au mollet']],
  [['muscle', 'muscular'], ['Lesión muscular', 'Muscle injury', 'Lesão muscular', 'إصابة عضلية', 'Infortunio muscolare', 'Blessure musculaire']],
  [['foot'], ['Lesión en el pie', 'Foot injury', 'Lesão no pé', 'إصابة في القدم', 'Infortunio al piede', 'Blessure au pied']],
  [['shoulder'], ['Lesión de hombro', 'Shoulder injury', 'Lesão no ombro', 'إصابة في الكتف', 'Infortunio alla spalla', 'Blessure à l’épaule']],
  [['hip'], ['Lesión de cadera', 'Hip injury', 'Lesão no quadril', 'إصابة في الورك', 'Infortunio all’anca', 'Blessure à la hanche']],
  [['back'], ['Lesión de espalda', 'Back injury', 'Lesão nas costas', 'إصابة في الظهر', 'Infortunio alla schiena', 'Blessure au dos']],
  [['concussion', 'head'], ['Traumatismo craneal', 'Head injury', 'Traumatismo craniano', 'ارتجاج', 'Trauma cranico', 'Traumatisme crânien']],
  [['knock'], ['Golpe', 'Knock', 'Pancada', 'ارتطام', 'Colpo', 'Coup']],
  [['virus', 'covid', 'corona'], ['COVID-19', 'COVID-19', 'COVID-19', 'كوفيد-19', 'COVID-19', 'COVID-19']],
  [['illness', 'sick', 'flu'], ['Enfermedad', 'Illness', 'Doença', 'مرض', 'Malattia', 'Maladie']],
  [['fracture', 'broken'], ['Fractura', 'Fracture', 'Fratura', 'كسر', 'Frattura', 'Fracture']],
  [['suspend'], ['Suspendido', 'Suspended', 'Suspenso', 'موقوف', 'Squalificato', 'Suspendu']],
  [['injury', 'injured'], ['Lesión', 'Injury', 'Lesão', 'إصابة', 'Infortunio', 'Blessure']],
]

/** Traduce el tipo de lesión de la API (en inglés) por palabra clave; si no matchea, lo deja igual. */
export function translateInjury(type: string, lang: Lang): string {
  const s = normalizeForSearch(type)
  for (const [keys, six] of INJURY_RULES) {
    if (keys.some(k => s.includes(k))) return six[IDX[lang]] || six[0]
  }
  return type
}

// ── Tipo de traspaso (API-Football /transfers) ─────────────────────────────
// El `type` viene en inglés ("Transfer", "Free", "Loan") o como un fee ("€ 5M").
const TR_FREE: Six = ['Libre', 'Free', 'Livre', 'مجاني', 'Svincolato', 'Libre']
const TR_LOAN: Six = ['Préstamo', 'Loan', 'Empréstimo', 'إعارة', 'Prestito', 'Prêt']
const TR_TRANSFER: Six = ['Traspaso', 'Transfer', 'Transferência', 'انتقال', 'Trasferimento', 'Transfert']

/**
 * Traduce el tipo de traspaso. Si es un fee (contiene € o una cifra) lo deja tal
 * cual (es el monto); "N/A" o vacío se muestra como "—".
 */
export function translateTransferType(type: string, lang: Lang): string {
  const raw = (type ?? '').trim()
  if (!raw || /n\/?a/i.test(raw)) return '—'
  if (/free/i.test(raw)) return TR_FREE[IDX[lang]] || TR_FREE[0]
  if (/loan/i.test(raw)) return TR_LOAN[IDX[lang]] || TR_LOAN[0]
  if (/€|\d/.test(raw)) return raw
  if (/transfer/i.test(raw)) return TR_TRANSFER[IDX[lang]] || TR_TRANSFER[0]
  return raw
}
