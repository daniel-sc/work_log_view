<template>
  <div class="header-banner">
    <div class="header-content">
      <h1>Work Log Analyzer</h1>
      <p class="purpose-text">
        Upload your CSV work log file to visualize and analyze your weekly work patterns. Adjust the
        idle threshold to filter out breaks.
      </p>
      <p>
        Work log files are assumed to be created by
        <a href="https://github.com/daniel-sc/work_log" target="_blank" rel="noopener noreferrer"
          >work_log</a
        >
        - this viewer can be found on
        <a
          href="https://github.com/daniel-sc/work_log_view"
          target="_blank"
          rel="noopener noreferrer"
          >GitHub</a
        >.
      </p>
    </div>
  </div>
  <div class="app-container">
    <div class="config">
      <label for="idleThreshold">Ignore idle time up to (sec):</label>
      <input id="idleThreshold" type="number" v-model.number="idleThreshold" min="0" />
    </div>
    <div class="drop-area" @dragover.prevent @dragenter.prevent @drop="handleDrop">
      <p>Drag and drop your CSV file here</p>
    </div>
    <!-- Full-screen overlay drop zone when dragging -->
    <div
      v-if="isDragging"
      class="full-drop-zone"
      @dragover.prevent
      @dragenter.prevent
      @drop="handleDrop"
    >
      <p>Drop your CSV file anywhere</p>
    </div>
    <div v-if="weeks.length > 0" class="week-select">
      <label for="weekSelect">Select Week:</label>
      <select id="weekSelect" v-model="selectedWeekStart">
        <option
          v-for="week in weeks"
          :key="week.weekStart.toISOString()"
          :value="week.weekStart.toISOString()"
        >
          Week of {{ formatDate(week.weekStart) }}
        </option>
      </select>
    </div>
    <div v-if="selectedWeek" class="timetable">
      <h2>TimeTable for Week of {{ formatDate(selectedWeek.weekStart) }}</h2>
      <time-table-chart :data="timeTableChartData"></time-table-chart>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  type AggregatedBlock,
  aggregateToBlocks,
  type CsvEntry,
  groupBlocksByWeek,
  parseCsv,
  type WeekData,
} from '../aggregator'
import TimeTableChart from '@/components/TimeTableChart.vue'

// Configuration: idle threshold (in seconds).
const idleThreshold = ref(300)
// Raw CSV text and parsed entries.
const rawCsvText = ref<string>('')
const parsedEntries = computed<CsvEntry[]>(() => parseCsv(rawCsvText.value))
// Aggregated blocks and weeks.
const blocks = computed<AggregatedBlock[]>(() =>
  aggregateToBlocks(parsedEntries.value, idleThreshold.value),
)
const weeks = computed<WeekData[]>(() => groupBlocksByWeek(blocks.value))
const weekStarts = computed<string[]>(() => weeks.value.map((week) => week.weekStart.toISOString()))

watch(rawCsvText, () => {
  caches.open('worklog').then((cache) => {
    cache.put('worklog.csv', new Response(rawCsvText.value))
  })
})

watch(weekStarts, (newWeeks, oldWeeks) => {
  if (newWeeks.join(',') === oldWeeks.join(',') || newWeeks.length === 0) {
    return
  }
  // Automatically select the latest week.
  selectedWeekStart.value = newWeeks.reduce((prev, curr) => (curr > prev ? curr : prev))
})

// The selected week, identified by its Monday (ISO string).
const selectedWeekStart = ref<string>('')

// Drag state management for full-screen drop zone.
const isDragging = ref(false)
const dragCounter = ref(0)

// Compute the selected week from weeks and the select value.
const selectedWeek = computed<WeekData | null>(
  () =>
    weeks.value.find((week) => week.weekStart.toISOString() === selectedWeekStart.value) || null,
)
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const timeTableChartData = computed(() => {
  if (!selectedWeek.value) {
    return []
  }
  return selectedWeek.value.days.flatMap((d) =>
    d.blocks.map((b) => ({
      day: weekdays[(d.date.getDay() + 6) % 7],
      label: 'work',
      start: getTimeFractional(b.from),
      end: getTimeFractional(b.to),
    })),
  )
})

function handleDragEnter(event: DragEvent) {
  event.preventDefault()
  dragCounter.value++
  isDragging.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  dragCounter.value--
  if (dragCounter.value <= 0) {
    isDragging.value = false
    dragCounter.value = 0
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
}

// Handle CSV file drop.
const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
  dragCounter.value = 0
  if (event.dataTransfer && event.dataTransfer.files.length) {
    const file = event.dataTransfer.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') {
        rawCsvText.value = text
      }
    }
    reader.readAsText(file)
  }
}

onMounted(async () => {
  // Load configuration.
  const savedConfig = localStorage.getItem('worklogConfig')
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig)
      if (config.idleThreshold !== undefined) {
        idleThreshold.value = config.idleThreshold
      }
    } catch (e) {
      console.error('Failed to parse config from localStorage', e)
    }
  }

  const cache = await caches.open('worklog')
  const cachedResponse = await cache.match('worklog.csv')
  if (cachedResponse) {
    rawCsvText.value = await cachedResponse.text()
  }

  // Add window drag event listeners for full-screen drop zone.
  window.addEventListener('dragenter', handleDragEnter)
  window.addEventListener('dragleave', handleDragLeave)
  window.addEventListener('dragover', handleDragOver)
  window.addEventListener('drop', handleDrop)
})

onUnmounted(() => {
  window.removeEventListener('dragenter', handleDragEnter)
  window.removeEventListener('dragleave', handleDragLeave)
  window.removeEventListener('dragover', handleDragOver)
  window.removeEventListener('drop', handleDrop)
})

// Persist idleThreshold changes.
watch(idleThreshold, (newVal) => {
  const config = { idleThreshold: newVal }
  localStorage.setItem(
    'worklogConfig',
    JSON.stringify(config, (key, value) => (value instanceof Date ? value.toISOString() : value)),
  )
})

const formatDate = (date: Date) => {
  return date.toLocaleDateString()
}

function getTimeFractional(date: Date): number {
  return date.getHours() + date.getMinutes() / 60
}
</script>

<style scoped>
.header-banner {
  width: 100%;
  background: linear-gradient(90deg, var(--sunglow), var(--bright-pink-crayola));
  padding: 2rem 0;
  margin-bottom: 2rem;
}

.header-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 1rem;
  text-align: center;
  color: var(--white);
}

.app-container {
  max-width: 1000px;
  width: 80vw;
  margin: 0 auto;
  padding: 2rem;
  background-color: var(--white);
  border-radius: 0;
  color: var(--midnight-green);
  position: relative;
}

/* Section backgrounds for flat, edgy design */
.config,
.week-select,
.timetable {
  background-color: var(--grey-light);
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.config label,
.week-select label {
  margin-right: 0.5rem;
  font-weight: bold;
  color: var(--blue-ncs);
}

.config input {
  padding: 0.5rem;
  border: 1px solid var(--grey);
  border-radius: 0;
  width: 100px;
}

select {
  padding: 0.5rem;
  border: 1px solid var(--grey);
  border-radius: 0;
}

.drop-area {
  border: 2px dashed var(--grey);
  border-radius: 0;
  padding: 3rem;
  text-align: center;
  color: var(--grey-dark);
  transition:
    border-color 0.3s,
    background-color 0.3s;
  background-color: var(--grey-light);
  margin-bottom: 1.5rem;
}

.drop-area:hover {
  border-color: var(--sunglow);
  background-color: var(--emerald);
  color: var(--white);
}

.full-drop-zone {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, var(--sunglow), var(--bright-pink-crayola));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  color: var(--white);
  font-size: 1.8rem;
  text-align: center;
  transition: opacity 0.3s;
  border-radius: 0;
}
</style>
