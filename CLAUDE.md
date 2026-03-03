# Scout Platform

Plataforma de scouting de fútbol con datos de Google Sheets.

## Ejecutar el proyecto

```bash
npm install    # Instalar dependencias
npm run dev    # Servidor de desarrollo (http://localhost:5173)
```

## Build para producción

```bash
npm run build    # Compila TypeScript y genera bundle
npm run preview  # Previsualiza el build
```

## Stack

- React 18 + TypeScript
- Vite 7
- Tailwind CSS
- Recharts (gráficos)
- PapaParse (CSV)
- jsPDF + html2canvas (exportar PDF)

## Estructura

- `src/pages/` - Páginas principales (Scouting Externo/Interno, Seguimiento, Comparación)
- `src/components/` - Componentes UI
- `src/context/DataContext.tsx` - Carga y provee datos de jugadores
- `src/constants/scoring.ts` - URLs de Google Sheets y configuración de métricas
- `src/services/csvService.ts` - Parseo de CSV

## Datos

Los datos vienen de Google Sheets publicados como CSV. Las URLs están en `src/constants/scoring.ts`.
En desarrollo, Vite usa un proxy (`/sheets-proxy`) para evitar CORS.
