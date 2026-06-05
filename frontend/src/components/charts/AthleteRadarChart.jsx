import { useMemo } from 'react'

import {

  Radar,

  RadarChart,

  PolarGrid,

  PolarAngleAxis,

  PolarRadiusAxis,

  ResponsiveContainer,

  Tooltip,

} from 'recharts'

import { formatRadarData } from '../../utils/formatRadarData'
import { CHART_CONTINUITY } from './chartDefaults'



function RadarTooltip({ active, payload }) {

  if (!active || !payload?.length) return null

  const row = payload[0]?.payload

  if (!row) return null



  let detail = 'No data in window'

  if (row.hasData) {

    if (row.subject === 'ACWR Safety' && row.acwrRaw != null) {

      detail = `ACWR ${row.acwrRaw} · safety ${row.value}/100`

    } else {

      detail = `${row.value} / 100`

    }

  } else if (row.subject === 'ACWR Safety' && row.acwrRaw != null) {

    detail = `ACWR ${row.acwrRaw} · safety ${row.value}/100`

  }



  return (

    <div

      style={{

        background: '#1A1D24',

        border: '1px solid rgba(255,255,255,0.12)',

        borderRadius: '8px',

        padding: '10px 14px',

        fontSize: '12px',

      }}

    >

      <p style={{ color: '#9ca3af', margin: '0 0 4px' }}>{row.subject}</p>

      <p

        style={{

          color: row.hasData ? '#3b82f6' : '#6b7280',

          margin: 0,

          fontWeight: 600,

        }}

      >

        {detail}

      </p>

    </div>

  )

}



/**

 * @param {object} props

 * @param {object|null} props.playerData - /dashboard/radar-metrics response

 */

export default function AthleteRadarChart({

  playerData = null,

  fillColor = '#3b82f6',

  height = 300,

}) {

  const { axes: chartData, axisCount, hasWhoop } = useMemo(

    () => formatRadarData(playerData),

    [playerData],

  )



  const populatedCount = chartData.filter((a) => a.hasData).length



  if (!playerData) {

    return (

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>

        Select an athlete to view performance radar.

      </p>

    )

  }



  const shapeLabel = hasWhoop

    ? 'Heptagon (7 axes)'

    : 'Pentagon (5 axes)'



  return (

    <div style={{ width: '100%' }}>

      <div

        style={{

          fontSize: '11px',

          color: 'var(--text-secondary)',

          marginBottom: '8px',

        }}

      >

        {shapeLabel}: {populatedCount} of {axisCount} axes with data

        {playerData.current?.session_date

          ? ` · latest ${playerData.current.session_date}`

          : ''}

        {playerData.current?.acwr != null

          ? ` · ACWR ${playerData.current.acwr}`

          : ''}

      </div>

      <ResponsiveContainer width="100%" height={height}>

        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={chartData}>

          <PolarGrid stroke="rgba(255,255,255,0.12)" />

          <PolarAngleAxis

            dataKey="subject"

            tick={{ fill: '#9ca3af', fontSize: 11 }}

          />

          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />

          <Radar

            name="Performance"

            dataKey="value"

            stroke={fillColor}

            fill={fillColor}

            fillOpacity={0.45}

            strokeWidth={2}

            dot={(props) => {

              const { cx, cy, payload } = props

              if (!payload?.hasData) return null

              return (

                <circle

                  cx={cx}

                  cy={cy}

                  r={3}

                  fill={fillColor}

                  stroke="#fff"

                  strokeWidth={1}

                />

              )

            }}

            {...CHART_CONTINUITY}

          />

          <Tooltip content={<RadarTooltip />} />

        </RadarChart>

      </ResponsiveContainer>

      <p

        style={{

          fontSize: '10px',

          color: 'var(--text-secondary)',

          margin: '8px 0 0',

        }}

      >

        Empty spokes (centre) = metric not available; filled spokes = indexed vs

        30-day baseline.

      </p>

    </div>

  )

}


