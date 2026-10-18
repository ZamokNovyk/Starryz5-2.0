'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Flame, 
  Eye, 
  Heart, 
  Users, 
  Zap, 
  Star, 
  TrendingUp, 
  RotateCw, 
  Info, 
  Code2, 
  Copy, 
  Check, 
  Calendar,
  Sparkles,
  Layers
} from 'lucide-react';
import { 
  getStudentHistoricalStats, 
  StudentStatsSummary, 
  StudentDailyStat,
  SUPABASE_PG_CRON_SQL 
} from '@/src/lib/studentStats';

type MetricType = 'views' | 'crushes' | 'knows' | 'fans' | 'score';

interface StudentTrendsEngineProps {
  studentId: string;
  studentName: string;
  currentValues: {
    knowsCount: number;
    fansCount: number;
    crushesCount: number;
    score: number;
    viewsCount?: number;
  };
}

interface MetricConfig {
  id: MetricType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  fillColor: string;
  lineColor: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  unit?: string;
  formatValue: (v: number) => string;
}

const METRICS_CONFIG: Record<MetricType, MetricConfig> = {
  views: {
    id: 'views',
    label: 'Visualizaciones',
    icon: Eye,
    color: '#a855f7', // purple
    fillColor: 'url(#views-gradient)',
    lineColor: '#a855f7',
    dotColor: '#c084fc',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    formatValue: (v) => v.toLocaleString(),
  },
  crushes: {
    id: 'crushes',
    label: 'Flechazos / Crushes',
    icon: Heart,
    color: '#ec4899', // pink
    fillColor: 'url(#crushes-gradient)',
    lineColor: '#ec4899',
    dotColor: '#f472b6',
    badgeBg: 'bg-pink-500/10',
    badgeText: 'text-pink-400',
    formatValue: (v) => v.toString(),
  },
  knows: {
    id: 'knows',
    label: 'Yo Te Conozco',
    icon: Users,
    color: '#3b82f6', // blue
    fillColor: 'url(#knows-gradient)',
    lineColor: '#38bdf8',
    dotColor: '#60a5fa',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-400',
    formatValue: (v) => v.toString(),
  },
  fans: {
    id: 'fans',
    label: 'Fans',
    icon: Zap,
    color: '#eab308', // amber/yellow
    fillColor: 'url(#fans-gradient)',
    lineColor: '#facc15',
    dotColor: '#fde047',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    formatValue: (v) => v.toString(),
  },
  score: {
    id: 'score',
    label: 'Evolución de Calificación',
    icon: Star,
    color: '#10b981', // emerald
    fillColor: 'url(#score-gradient)',
    lineColor: '#34d399',
    dotColor: '#6ee7b7',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    formatValue: (v) => `${v.toFixed(1)} / 5.0`,
  },
};

/**
 * Calcula un path SVG con curvas bezier suaves (Catmull-Rom / Spline)
 */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 >= points.length ? i + 1 : i + 2];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

export default function StudentTrendsEngine({
  studentId,
  studentName,
  currentValues,
}: StudentTrendsEngineProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('knows');
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [calculationMode, setCalculationMode] = useState<'daily' | 'cumulative'>('daily');
  const [compareAverage, setCompareAverage] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [summaryData, setSummaryData] = useState<StudentStatsSummary | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getStudentHistoricalStats(studentId, periodDays, currentValues)
      .then((res) => {
        if (isMounted) {
          setSummaryData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error cargando estadísticas históricas:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId, periodDays, currentValues.knowsCount, currentValues.fansCount, currentValues.crushesCount, currentValues.score, currentValues.viewsCount]);

  const activeMetricConfig = METRICS_CONFIG[selectedMetric];

  // El filtro Diario vs Acumulativo aplica específicamente a visualizaciones y calificación
  const isToggleApplicable = selectedMetric === 'views' || selectedMetric === 'score';
  const isDaily = isToggleApplicable && calculationMode === 'daily';

  // Extraer valores para la métrica activa
  const chartPoints = useMemo(() => {
    if (!summaryData || summaryData.stats.length === 0) {
      return { student: [], campus: [], yMin: 0, yMax: 10, yTicks: [], zeroY: undefined };
    }

    const getRawMetricVal = (s: StudentDailyStat, m: MetricType): number => {
      switch (m) {
        case 'views': return s.views_count;
        case 'crushes': return s.crushes_count;
        case 'knows': return s.knows_count;
        case 'fans': return s.fans_count;
        case 'score': return s.score;
      }
    };

    // Calcular valores finales considerando el modo Diario (incremental) vs Acumulativo
    const getCalculatedVal = (
      list: StudentDailyStat[],
      idx: number,
      isStudent: boolean
    ): number => {
      const current = list[idx];
      if (!isDaily) {
        return getRawMetricVal(current, selectedMetric);
      }

      if (selectedMetric === 'views') {
        if (idx === 0) {
          if (isStudent && summaryData.baseline) {
            return Math.max(0, current.views_count - summaryData.baseline.views_count);
          }
          return 0;
        }
        return Math.max(0, current.views_count - list[idx - 1].views_count);
      }

      if (selectedMetric === 'score') {
        if (idx === 0) {
          if (isStudent && summaryData.baseline) {
            return Number((current.score - summaryData.baseline.score).toFixed(2));
          }
          return 0.0;
        }
        return Number((current.score - list[idx - 1].score).toFixed(2));
      }

      return getRawMetricVal(current, selectedMetric);
    };

    const studentVals = summaryData.stats.map((_, idx) =>
      getCalculatedVal(summaryData.stats, idx, true)
    );
    const campusVals = summaryData.campusAverage.map((_, idx) =>
      getCalculatedVal(summaryData.campusAverage, idx, false)
    );

    const allVals = compareAverage ? [...studentVals, ...campusVals] : studentVals;
    let minVal = Math.min(...allVals);
    let maxVal = Math.max(...allVals);

    // Escala limpia y robusta para cada métrica
    if (selectedMetric === 'score') {
      if (isDaily) {
        const maxAbs = Math.max(0.2, ...allVals.map(v => Math.abs(v)));
        const rounded = Number((Math.ceil(maxAbs * 5) / 5).toFixed(1));
        minVal = -rounded;
        maxVal = rounded;
      } else {
        minVal = 0;
        maxVal = 5.0;
      }
    } else if (selectedMetric === 'views' && isDaily) {
      minVal = 0;
      maxVal = Math.max(4, Math.ceil(maxVal * 1.25));
    } else {
      const padding = Math.max(2, Math.round((maxVal - minVal) * 0.15));
      minVal = Math.max(0, minVal - padding);
      maxVal = maxVal + padding + 1;
      if (maxVal === minVal) maxVal = minVal + 5;
    }

    // Dimensiones de dibujo SVG
    const width = 840;
    const height = 280;
    const padLeft = 55;
    const padRight = 30;
    const padTop = 30;
    const padBottom = 45;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const count = summaryData.stats.length;

    const mapX = (idx: number) => padLeft + (idx / Math.max(1, count - 1)) * plotW;
    const mapY = (val: number) => {
      const pct = (val - minVal) / Math.max(0.001, maxVal - minVal);
      return padTop + (1 - pct) * plotH;
    };

    const studentCoords = summaryData.stats.map((s, idx) => ({
      x: mapX(idx),
      y: mapY(studentVals[idx]),
      rawVal: studentVals[idx],
      cumulativeVal: getRawMetricVal(s, selectedMetric),
      label: s.day_label,
      date: s.date,
    }));

    const campusCoords = summaryData.campusAverage.map((s, idx) => ({
      x: mapX(idx),
      y: mapY(campusVals[idx]),
      rawVal: campusVals[idx],
      cumulativeVal: getRawMetricVal(s, selectedMetric),
      label: s.day_label,
      date: s.date,
    }));

    // Generar 5 marcas para el eje Y
    const yTicks: { y: number; val: string }[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = minVal + (i / steps) * (maxVal - minVal);
      let tickLabel = '';
      if (selectedMetric === 'score') {
        if (isDaily) {
          tickLabel = val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
        } else {
          tickLabel = val.toFixed(1);
        }
      } else {
        tickLabel = Math.round(val).toString();
      }
      yTicks.push({
        y: padTop + (1 - i / steps) * plotH,
        val: tickLabel,
      });
    }

    const zeroY = isDaily && selectedMetric === 'score' ? mapY(0) : undefined;

    return {
      student: studentCoords,
      campus: campusCoords,
      yMin: minVal,
      yMax: maxVal,
      yTicks,
      zeroY,
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotH,
    };
  }, [summaryData, selectedMetric, compareAverage, isDaily]);

  // Generación de rutas SVG
  const studentLinePath = useMemo(() => buildSmoothPath(chartPoints.student), [chartPoints.student]);
  const campusLinePath = useMemo(() => buildSmoothPath(chartPoints.campus), [chartPoints.campus]);

  const studentAreaPath = useMemo(() => {
    if (chartPoints.student.length === 0) return '';
    const first = chartPoints.student[0];
    const last = chartPoints.student[chartPoints.student.length - 1];
    const bottomY = (chartPoints.padTop || 30) + (chartPoints.plotH || 205);
    return `${studentLinePath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [studentLinePath, chartPoints]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_PG_CRON_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const getMetricDisplayValue = (m: MetricType): string => {
    if (!summaryData) return '0';
    switch (m) {
      case 'views': return summaryData.totals.views.toLocaleString();
      case 'crushes': return summaryData.totals.crushes.toString();
      case 'knows': return summaryData.totals.knows.toString();
      case 'fans': return summaryData.totals.fans.toString();
      case 'score': return `${summaryData.totals.score.toFixed(1)} / 5.0`;
    }
  };

  const getMetricTrendLabel = (m: MetricType): string => {
    if (!summaryData) return '';
    switch (m) {
      case 'views': return summaryData.trends.viewsTrend;
      case 'crushes': return summaryData.trends.crushesTrend;
      case 'knows': return summaryData.trends.knowsTrend;
      case 'fans': return summaryData.trends.fansTrend;
      case 'score': return summaryData.trends.scoreTrend;
    }
  };

  return (
    <div className="bg-[#0b0c10] border border-zinc-800/80 rounded-2xl p-5 sm:p-7 space-y-6 text-left shadow-2xl relative overflow-hidden">
      {/* Glow ambiental de fondo */}
      <div 
        className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-[100px] pointer-events-none opacity-20 transition-colors duration-700"
        style={{ backgroundColor: activeMetricConfig.color }}
      />

      {/* HEADER DE TENDENCIAS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[#eab308] text-[11px] font-black uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 fill-[#eab308]" />
              Starryz Trends Engine v2.0
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide flex items-center gap-2">
            Análisis de Popularidad e Impacto
          </h2>
          <p className="text-xs text-zinc-400 font-medium max-w-xl">
            Compara la evolución de este perfil con el promedio del campus o con otro perfil
          </p>
        </div>


        {/* CONTROLES DERECHA: Modo y Periodo */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Modo: Diario vs Acumulado (activo solo para visualizaciones y calificación) */}
          {isToggleApplicable && (
            <div className="flex items-center bg-[#14151b] border border-zinc-700/80 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setCalculationMode('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  calculationMode === 'daily'
                    ? 'bg-[#eab308] text-black shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Muestra los registros específicos generados en cada día"
              >
                Diario
              </button>
              <button
                type="button"
                onClick={() => setCalculationMode('cumulative')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  calculationMode === 'cumulative'
                    ? 'bg-[#eab308] text-black shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Muestra el total histórico acumulado progresivamente"
              >
                Acumulado
              </button>
            </div>
          )}

          {/* Selector de Rango */}
          <div className="relative">
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="bg-[#14151b] border border-zinc-700/80 text-zinc-200 text-xs font-bold rounded-xl px-3.5 py-2 pr-8 appearance-none cursor-pointer hover:border-amber-500/50 focus:outline-none focus:border-[#eab308] transition-colors"
            >
              <option value={7}>Últimos 7 días</option>
              <option value={14}>Últimos 14 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
            <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* CARDS SELECTORAS DE MÉTRICAS */}
      <div className="flex flex-row items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
        {(Object.keys(METRICS_CONFIG) as MetricType[]).map((metricKey) => {
          const config = METRICS_CONFIG[metricKey];
          const isSelected = selectedMetric === metricKey;
          const IconComponent = config.icon;

          return (
            <div
              key={metricKey}
              onClick={() => setSelectedMetric(metricKey)}
              className={`relative shrink-0 p-2.5 sm:p-4 rounded-xl border transition-all cursor-pointer select-none group flex items-center justify-between gap-2.5 ${
                isSelected
                  ? 'bg-[#14151d] border-[#eab308] shadow-[0_0_20px_rgba(234,179,8,0.15)] ring-1 ring-[#eab308]'
                  : 'bg-[#0f1016] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#13141b]'
              }`}
            >
              <div className="flex flex-col justify-center min-w-0">
                <span className={`text-xs sm:text-sm font-bold transition-colors truncate ${
                  isSelected ? 'block text-white' : 'hidden sm:block text-zinc-300 group-hover:text-white'
                }`}>
                  {config.label}
                </span>
              </div>

              <div 
                className="p-2 rounded-lg transition-all shrink-0 group-hover:scale-110"
                style={{ 
                  backgroundColor: `${config.color}20`, 
                  color: config.color 
                }}
              >
                <IconComponent className="w-4 h-4" />
              </div>

              {/* Indicador de pestaña activa */}
              {isSelected && (
                <div 
                  className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                  style={{ backgroundColor: '#eab308' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ÁREA DEL GRÁFICO SVG INTERACTIVO */}
      <div className="relative bg-[#0d0e14] border border-zinc-800/80 rounded-2xl p-4 sm:p-6 overflow-hidden">
        {loading ? (
          <div className="h-[280px] flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cargando serie temporal...</p>
          </div>
        ) : (
          <div className="w-full relative">
            {/* ENCABEZADO SUPERIOR DEL GRÁFICO CON MODO ACTIVO */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <activeMetricConfig.icon className="w-4 h-4" style={{ color: activeMetricConfig.color }} />
                  {activeMetricConfig.label}
                </span>
                {isToggleApplicable && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500/10 text-[#eab308] border border-amber-500/30 uppercase tracking-wider">
                    {calculationMode === 'daily' ? 'Modo Diario (Neto)' : 'Modo Acumulado (Total)'}
                  </span>
                )}
              </div>

              {isToggleApplicable && (
                <div className="text-[11px] text-zinc-400 font-medium">
                  {calculationMode === 'daily'
                    ? selectedMetric === 'views'
                      ? 'Nuevas visualizaciones por día'
                      : 'Variación neta diaria (± puntos)'
                    : selectedMetric === 'views'
                      ? 'Historial acumulado total'
                      : 'Evolución de promedio general'}
                </div>
              )}
            </div>

            <svg
              viewBox={`0 0 ${chartPoints.width || 840} ${chartPoints.height || 280}`}
              className="w-full h-auto max-h-[340px] overflow-visible"
            >
              <defs>
                {/* Gradiente para Visualizaciones */}
                <linearGradient id="views-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#a855f7" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                </linearGradient>

                {/* Gradiente para Crushes */}
                <linearGradient id="crushes-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#ec4899" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                </linearGradient>

                {/* Gradiente para Yo Te Conozco */}
                <linearGradient id="knows-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>

                {/* Gradiente para Fans */}
                <linearGradient id="fans-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#eab308" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#ca8a04" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#ca8a04" stopOpacity="0.0" />
                </linearGradient>

                {/* Gradiente para Nota */}
                <linearGradient id="score-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#059669" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* LÍNEAS GUÍA HORIZONTALES Y ETIQUETAS EJE Y */}
              {chartPoints.yTicks?.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={chartPoints.padLeft}
                    y1={tick.y}
                    x2={chartPoints.width - chartPoints.padRight}
                    y2={tick.y}
                    stroke="#27272a"
                    strokeWidth="1"
                    strokeDasharray={i === 0 || i === chartPoints.yTicks.length - 1 ? 'none' : '3 3'}
                  />
                  <text
                    x={chartPoints.padLeft - 10}
                    y={tick.y + 4}
                    textAnchor="end"
                    className="fill-zinc-500 text-[11px] font-mono select-none"
                  >
                    {tick.val}
                  </text>
                </g>
              ))}

              {/* LÍNEA CERO DE REFERENCIA PARA VARIACIÓN DIARIA DE NOTA */}
              {isDaily && selectedMetric === 'score' && chartPoints.zeroY !== undefined && (
                <g>
                  <line
                    x1={chartPoints.padLeft}
                    y1={chartPoints.zeroY}
                    x2={chartPoints.width - chartPoints.padRight}
                    y2={chartPoints.zeroY}
                    stroke="#52525b"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                  <text
                    x={chartPoints.padLeft - 10}
                    y={chartPoints.zeroY + 4}
                    textAnchor="end"
                    className="fill-zinc-400 text-[10px] font-mono font-bold select-none"
                  >
                    0.0
                  </text>
                </g>
              )}

              {/* LÍNEA DE PROMEDIO DEL CAMPUS (COMPARACIÓN) */}
              {compareAverage && campusLinePath && (
                <g>
                  <path
                    d={campusLinePath}
                    fill="none"
                    stroke="#71717a"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    opacity="0.8"
                  />
                  {chartPoints.campus.map((pt, idx) => (
                    <circle
                      key={`campus-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="3"
                      fill="#a1a1aa"
                    />
                  ))}
                </g>
              )}

              {/* ÁREA CON DEGRADADO (RELLENO BAJO LA CURVA) */}
              {studentAreaPath && (
                <path
                  d={studentAreaPath}
                  fill={activeMetricConfig.fillColor}
                />
              )}

              {/* LÍNEA PRINCIPAL SUAVE */}
              {studentLinePath && (
                <path
                  d={studentLinePath}
                  fill="none"
                  stroke={activeMetricConfig.lineColor}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* PUNTOS DE DATOS */}
              {chartPoints.student.map((pt, idx) => {
                const isHovered = hoveredIndex === idx;
                return (
                  <g 
                    key={`point-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Área invisible amplia para facilitar toque/hover */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="16"
                      fill="transparent"
                    />

                    {/* Resplandor al hacer hover */}
                    {isHovered && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="10"
                        fill={activeMetricConfig.color}
                        opacity="0.35"
                      />
                    )}

                    {/* Punto visible */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : 4.5}
                      fill={activeMetricConfig.dotColor}
                      stroke="#0b0c10"
                      strokeWidth="2"
                      className="transition-all duration-150"
                    />

                    {/* ETIQUETAS EJE X (FECHAS) */}
                    <text
                      x={pt.x}
                      y={(chartPoints.height || 280) - 12}
                      textAnchor="middle"
                      className={`text-[11px] font-mono select-none transition-colors ${
                        isHovered ? 'fill-white font-bold' : 'fill-zinc-400'
                      }`}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* TOOLTIP FLOTANTE EN HOVER */}
            {hoveredIndex !== null && chartPoints.student[hoveredIndex] && (
              <div
                className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 bg-[#181920] border border-zinc-700 text-white rounded-xl px-3.5 py-2 shadow-2xl text-xs space-y-1"
                style={{
                  left: `${(chartPoints.student[hoveredIndex].x / (chartPoints.width || 840)) * 100}%`,
                  top: `${(chartPoints.student[hoveredIndex].y / (chartPoints.height || 280)) * 100}%`,
                }}
              >
                <div className="flex items-center gap-2 font-bold text-zinc-400 text-[11px] border-b border-zinc-800 pb-1">
                  <Calendar className="w-3 h-3 text-zinc-500" />
                  <span>{chartPoints.student[hoveredIndex].label} ({chartPoints.student[hoveredIndex].date})</span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <span className="text-zinc-300 font-medium">
                    {activeMetricConfig.label}
                    {isToggleApplicable && (
                      <span className="text-[10px] text-zinc-400 ml-1">
                        ({calculationMode === 'daily' ? 'Diario' : 'Acumulado'})
                      </span>
                    )}:
                  </span>
                  <span className="font-black text-amber-400">
                    {selectedMetric === 'views' ? (
                      isDaily
                        ? `${chartPoints.student[hoveredIndex].rawVal} ${chartPoints.student[hoveredIndex].rawVal === 1 ? 'vista hoy' : 'vistas hoy'}`
                        : `${chartPoints.student[hoveredIndex].rawVal.toLocaleString()} vistas`
                    ) : selectedMetric === 'score' ? (
                      isDaily
                        ? `${chartPoints.student[hoveredIndex].rawVal > 0 ? '+' : ''}${chartPoints.student[hoveredIndex].rawVal.toFixed(2)} pts`
                        : `${chartPoints.student[hoveredIndex].rawVal.toFixed(1)} / 5.0`
                    ) : (
                      activeMetricConfig.formatValue(chartPoints.student[hoveredIndex].rawVal)
                    )}
                  </span>
                </div>

                {isDaily && (selectedMetric === 'views' || selectedMetric === 'score') && (
                  <div className="flex items-center justify-between gap-3 text-[10px] text-zinc-400 pt-1 border-t border-zinc-800">
                    <span>Total acumulado:</span>
                    <span className="font-mono text-zinc-200">
                      {selectedMetric === 'views'
                        ? `${chartPoints.student[hoveredIndex].cumulativeVal.toLocaleString()} vistas`
                        : `${chartPoints.student[hoveredIndex].cumulativeVal.toFixed(1)} / 5.0`}
                    </span>
                  </div>
                )}

                {compareAverage && chartPoints.campus[hoveredIndex] && (
                  <div className="flex items-center justify-between gap-3 text-[10px] text-zinc-400">
                    <span>Promedio Campus:</span>
                    <span className="font-bold text-zinc-200">
                      {selectedMetric === 'views' ? (
                        isDaily
                          ? `${chartPoints.campus[hoveredIndex].rawVal} vistas`
                          : `${chartPoints.campus[hoveredIndex].rawVal.toLocaleString()} vistas`
                      ) : selectedMetric === 'score' ? (
                        isDaily
                          ? `${chartPoints.campus[hoveredIndex].rawVal > 0 ? '+' : ''}${chartPoints.campus[hoveredIndex].rawVal.toFixed(2)} pts`
                          : `${chartPoints.campus[hoveredIndex].rawVal.toFixed(1)} / 5.0`
                      ) : (
                        activeMetricConfig.formatValue(chartPoints.campus[hoveredIndex].rawVal)
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LEYENDA INFERIOR */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-800/80 text-xs text-zinc-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#eab308] inline-block shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
              <span className="font-bold text-zinc-200">Perfil: {studentName}</span>
            </div>

            {compareAverage && (
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-zinc-400 inline-block" />
                <span className="font-medium text-zinc-400">Promedio del Campus</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Info className="w-3.5 h-3.5 text-zinc-500" />
            <span>Datos actualizados en tiempo real según actividad del campus.</span>
          </div>
        </div>
      </div>

      {/* MODAL DE CÓDIGO SUPABASE PG_CRON */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#101116] border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-[#eab308]">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    Supabase pg_cron (Snapshot Diario)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Guarda la foto diaria de fans, crushes, votos y nota automáticamente cada 24h a costo $0.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-zinc-300">
              <p>
                Copia y pega este script en el <strong>SQL Editor de Supabase</strong> para habilitar el guardado histórico automático:
              </p>
              <div className="relative">
                <pre className="p-4 rounded-xl bg-[#08080c] border border-zinc-800 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-64 select-all">
                  {SUPABASE_PG_CRON_SQL}
                </pre>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-1.5 border border-zinc-700 transition-colors"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-5 py-2 rounded-xl bg-[#eab308] text-black font-extrabold text-xs uppercase hover:bg-[#d9a307] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
