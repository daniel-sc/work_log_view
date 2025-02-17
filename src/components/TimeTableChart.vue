<template>
  <!-- The chart will be rendered inside this div -->
  <div ref="chartContainer" />
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import * as d3 from 'd3'

/**
 * Example of the expected data format:
 * [
 *   { day: "Monday",    start: 6,  end: 9,   label: "Some Activity" },
 *   { day: "Monday",    start: 10, end: 11,  label: "Another Task" },
 *   { day: "Tuesday",   start: 7,  end: 8.5, label: "Morning Run" },
 *   { day: "Wednesday", start: 15, end: 17,  label: "Project Work" }
 * ]
 */
interface TimetableEntry {
  day: string
  start: number
  end: number
  label: string
}

const props = withDefaults(
  defineProps<{
    data: TimetableEntry[]
    width?: number
    height?: number
    minHour?: number
    maxHour?: number
    days?: string[]
  }>(),
  {
    /* Timetable data: array of objects with day, start, end, label, etc. */
    data: () => [],
    /* Overall width and height of the SVG (in px). */
    width: Math.min(window.innerWidth * 0.8, 950),
    height: 500,
    /* Minimum and maximum hour to show on the y-axis. Adjust as desired. */
    minHour: 7,
    maxHour: 18,
    /* Which days to show on the x-axis. */
    days: () => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
)

const chartContainer = ref(null)

onMounted(() => {
  drawChart()
})

// Re-draw chart whenever props.data changes.
watch(
  () => props.data,
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

  const xScale = d3.scaleBand().domain(props.days).range([0, innerWidth]).padding(0.2)

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
    .data(props.data)
    .enter()
    .append('rect')
    .attr('x', (d) => xScale(d.day) || 0)
    //  y is the *top* of the bar => yScale(d.start)
    .attr('y', (d) => yScale(d.start))
    .attr('width', xScale.bandwidth())
    //  bar height => difference between y(start) and y(end)
    .attr('height', (d) => yScale(d.end) - yScale(d.start))
    .attr('fill', '#4285F4') // pick any color you like
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

  // 7. Calculate total time and start/end times for each day.
  const dayData = props.days.map((day) => {
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
</style>
