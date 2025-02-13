<template>
  <!-- The chart will be rendered inside this div -->
  <div ref="chartContainer" />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
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

const props = withDefaults(defineProps<{
  data: TimetableEntry[]
  width?: number
  height?: number
  minHour?: number
  maxHour?: number
  days?: string[]
}>(), {
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
})

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
  const margin = { top: 20, right: 20, bottom: 30, left: 50 }
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

  // 4. Create scales.
  //    a) x-scale: scaleBand for discrete weekdays
  const xScale = d3
    .scaleBand()
    .domain(props.days as string[]) // e.g. ['Monday', 'Tuesday', ...]
    .range([0, innerWidth])
    .padding(0.2)

  //    b) y-scale: scaleLinear for hours (desc order, top=earliest)
  //       By default, the top is 0 and bottom is innerHeight.
  //       We want a domain of [maxHour, minHour] to invert it (max at top).
  const minHour = Math.min(props.minHour, ...props.data.map((d) => d.start))
  const maxHour = Math.max(props.maxHour, ...props.data.map((d) => d.end))
  const yScale = d3
    .scaleLinear()
    .domain([Math.floor(minHour), Math.ceil(maxHour)]) // reversed so top is max
    .range([0, innerHeight])

  // 5. Draw axes.
  //    a) X-axis
  g.append('g').attr('transform', `translate(0, ${innerHeight})`).call(d3.axisBottom(xScale))

  //    b) Y-axis, with a custom formatter for hours
  const formatHour = (d: number | d3.NumberValue) => {
    const hour = Math.floor(typeof d === 'number' ? d : d.valueOf())
    return hour + ':00'
  }
  g.append('g').call(d3.axisLeft(yScale).tickFormat(formatHour))

  // 6. Draw bars for each item in props.data.
  //    Each item has a 'day', 'start', 'end', etc.
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

  // 7. Calculate total time for each day.
  const totalTimePerDay = props.days.map((day) => {
    const total = props.data
      .filter((d) => d.day === day)
      .reduce((sum, d) => sum + (d.end - d.start), 0)
    return { day, total }
  })
  // 8. Add labels for total time.
  g.selectAll('.total-time-label')
    .data(totalTimePerDay)
    .enter()
    .append('text')
    .attr('class', 'total-time-label')
    .attr('x', (d) => xScale(d.day)! + xScale.bandwidth() / 2)
    .attr('y', -5) // Position above the top of the chart
    .attr('text-anchor', 'middle')
    .text((d) => `Total: ${factionalTimeToString(d.total)}`)
}

function factionalTimeToString(time: number): string {
  const minutes = Math.round((time % 1) * 60)
  return `${Math.floor(time)}:${minutes < 10 ? '0' : ''}${minutes}`
}
</script>

<style scoped>
/* You can add custom styling here if needed. */
</style>
