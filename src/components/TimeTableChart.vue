<template>
  <!-- The chart will be rendered inside this div -->
  <div ref="chartContainer" />
  <div
    class="tooltip"
    v-if="showTooltip"
    :style="{ top: Math.round(tooltipPosition.y) + 'px', left: Math.round(tooltipPosition.x) + 'px' }"
  >
    <div style="font-weight: bold">Top Activities</div>
    <div v-for="activity in hoveredRect?.activities.slice(0, 2)" :key="activity?.label">
      <span style="font-weight: bolder">{{ factionalTimeToString(activity.durationSec / (60*60)) }}</span>
      <span style="margin-left: 0.3rem">{{ activity.title }}</span>
    </div>
    <hr>
    <div>Total: <span style="font-weight: bold">{{ factionalTimeToString(hoveredRect.end - hoveredRect.start) }}</span></div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import * as d3 from 'd3'
import type { AggregatedActivity } from '@/aggregator.ts'

interface TimetableEntry {
  day: string
  start: number
  end: number
  activities: AggregatedActivity[]
}

const props = withDefaults(
  defineProps<{
    data: TimetableEntry[]
    width?: number
    height?: number
    minHour?: number
    maxHour?: number
    showWeekend?: boolean
    showSpan?: boolean
  }>(),
  {
    /* Timetable data: array of objects with day, start, end, label, etc. */
    data: () => [],
    /* Overall width and height of the SVG (in px). */
    width: Math.min(window.innerWidth - 3 * 32, 900),
    height: 500,
    /* Minimum and maximum hour to show on the y-axis. Adjust as desired. */
    minHour: 7,
    maxHour: 18,
    showWeekend: false,
    showSpan: false,
  },
)

const chartContainer = ref(null)
const showTooltip = ref(false)
const hoveredRect = ref<TimetableEntry | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })

onMounted(() => {
  drawChart()
})

// Re-draw chart whenever props.data changes.
watch(
  () => [props.data, props.showWeekend, props.showSpan],
  () => {
    nextTick(() => drawChart())
  },
  { deep: true },
)

function drawChart() {
  // 1. Clear any existing SVG.
  d3.select(chartContainer.value).select('svg').remove()

  // 2. Set up dimensions and margins.
  const margin = { top: 20, right: 40, bottom: 40, left: 50 }
  const innerWidth = props.width - margin.left - margin.right
  const innerHeight = props.height - margin.top - margin.bottom

  // 3. Create the SVG container.
  const svg = d3
    .select(chartContainer.value)
    .append('svg')
    .attr('width', props.width)
    .attr('height', props.height)

  // A group translated by the margin.
  const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`)

  const days = props.showWeekend
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const xScale = d3.scaleBand().domain(days).range([0, innerWidth]).padding(0.4)

  const minHour = Math.min(props.minHour, ...props.data.map((d) => d.start))
  const maxHour = Math.max(props.maxHour, ...props.data.map((d) => d.end))
  const yScale = d3
    .scaleLinear()
    .domain([Math.floor(minHour), Math.ceil(maxHour)]) // reversed so top is max
    .range([0, innerHeight])

  const xAxis = g
    .append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xScale))

  g.append('g').call(
    d3
      .axisLeft(yScale)
      .tickFormat(
        (d: number | d3.NumberValue) => Math.floor(typeof d === 'number' ? d : d.valueOf()) + ':00',
      ),
  )

  g.selectAll('rect')
    .data(props.data.filter((d) => days.includes(d.day)))
    .enter()
    .append('rect')
    .attr('x', (d) => xScale(d.day) || 0)
    //  y is the *top* of the bar => yScale(d.start)
    .attr('y', (d) => yScale(d.start))
    .attr('width', xScale.bandwidth())
    //  bar height => difference between y(start) and y(end)
    .attr('height', (d) => yScale(d.end) - yScale(d.start))
    .attr('fill', 'var(--bright-pink-crayola)')
    .append('title')
    .text((x) => `${factionalTimeToString(x.start)} - ${factionalTimeToString(x.end)}`)

  xAxis
    .selectAll('.tick')
    .append('text')
    .attr('x', 0)
    .attr('y', 40)
    .attr('fill', 'currentColor')
    .attr('text-anchor', 'middle')
    .text((d) => {
      const total = props.data
        .filter((x) => x.day === d)
        .reduce((sum, x) => sum + (x.end - x.start), 0)
      return `Total: ${factionalTimeToString(total)}`
    })

  if (props.showSpan) {
    // 7. Calculate total time and start/end times for each day.
    const dayData = days.map((day) => {
      const dayEntries = props.data.filter((d) => d.day === day)
      const start = Math.min(...dayEntries.map((d) => d.start))
      const end = Math.max(...dayEntries.map((d) => d.end))
      return { day, start, end, blockCount: dayEntries.length }
    })

    // 8. Draw braces and labels for total time.
    dayData.forEach((d) => {
      if (d.start < d.end && d.blockCount > 1) {
        // Draw brace
        const x = xScale(d.day)! + xScale.bandwidth() + 5
        const y1 = yScale(d.start)
        const y2 = yScale(d.end)
        const midY = (y1 + y2) / 2
        const depth = 5
        const bracePath = `M${x},${y1} l${depth},${depth} L${x + depth},${y2 - depth} l-${depth},${depth}`

        g.append('path')
          .attr('d', bracePath)
          .attr('stroke', 'black')
          .attr('stroke-width', 1)
          .attr('fill', 'none')

        g.append('text')
          .attr('x', x)
          .attr('y', midY - 6)
          .attr('text-anchor', 'start')
          .attr('alignment-baseline', 'middle')
          .attr('class', 'time-span-label')
          .attr('transform', `rotate(90, ${x + 7}, ${midY})`) // Rotate text by -90 degrees
          .text(`${factionalTimeToString(d.end - d.start)}`)
      }
    })
  }

  g.selectAll('rect')
    .on('pointerenter pointermove', (evt) => {
      showTooltip.value = true
      hoveredRect.value = evt.target.__data__
      const b = (evt.target as HTMLElement).getBoundingClientRect();

      tooltipPosition.value = { x: b.left + b.width + 5, y: b.top }
    })
    .on('pointerleave', () => (showTooltip.value = false))
}

function factionalTimeToString(time: number): string {
  const minutes = Math.round((time % 1) * 60)
  return `${Math.floor(time)}:${minutes < 10 ? '0' : ''}${minutes}`
}
</script>

<style scoped>
div :deep(text) {
  font-size: var(--font-size);
  font-family: var(--font-family), sans-serif;
}

.tooltip {
  position: fixed;
  z-index: 2;
  background-color: var(--emerald);
  padding: 0.5rem;
}

hr {
  border: none;
  border-top: 1px solid var(--midnight-green);
  margin: 0.5rem 0;
}
</style>
