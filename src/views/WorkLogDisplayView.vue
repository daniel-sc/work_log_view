<template>
  <div class="app-container">
    <h1>Work Log Analyzer</h1>
    <div class="config">
      <label for="idleThreshold">Ignore idle time up to (sec):</label>
      <input id="idleThreshold" type="number" v-model.number="idleThreshold" min="0" />
    </div>
    <div class="drop-area" @dragover.prevent @dragenter.prevent @drop="handleDrop">
      <p>Drag and drop your CSV file here</p>
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
      <time-table :weekData="selectedWeek"></time-table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch } from 'vue'
import {
  type AggregatedBlock,
  aggregateToBlocks,
  type CsvEntry,
  groupBlocksByWeek,
  parseCsv,
  type WeekData,
} from '../aggregator'
import TimeTable from '../components/TimeTable.vue'

export default defineComponent({
  name: 'WorkLogDisplayView',
  components: { TimeTable: TimeTable },
  setup() {
    // Configuration: idle threshold (in seconds).
    const idleThreshold = ref(300)
    // Raw CSV text and parsed entries.
    const rawCsvText = ref<string>('')
    const parsedEntries = ref<CsvEntry[]>([])
    // Aggregated blocks and weeks.
    const blocks = ref<AggregatedBlock[]>([])
    const weeks = ref<WeekData[]>([])
    // The selected week, identified by its Monday (ISO string).
    const selectedWeekStart = ref<string>('')

    // Read configuration from localStorage on mount.
    onMounted(() => {
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
      const savedData = localStorage.getItem('worklogData')
      if (savedData) {
        try {
          const data = JSON.parse(savedData, (key, value) =>
            typeof value === 'string' && value.match(/^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d[.:+\dZ]+$/)
              ? new Date(value)
              : value,
          )
          if (data.blocks && data.weeks) {
            blocks.value = data.blocks
            weeks.value = data.weeks
            // Automatically select the latest week.
            if (data.weeks.length > 0) {
              const latestWeek = weeks.value.reduce((prev, curr) =>
                curr.weekStart > prev.weekStart ? curr : prev,
              )
              selectedWeekStart.value = latestWeek.weekStart.toISOString()
            }
          }
        } catch (e) {
          console.error('Failed to parse data from localStorage', e)
        }
      }
    })

    // When idleThreshold changes, persist it and update aggregation if data exists.
    watch(idleThreshold, (newVal) => {
      const config = { idleThreshold: newVal }
      localStorage.setItem(
        'worklogConfig',
        JSON.stringify(config, (key, value) =>
          value instanceof Date ? value.toISOString() : value,
        ),
      )
      if (parsedEntries.value.length > 0) {
        updateAggregation()
      }
    })

    // Recompute blocks and weeks from parsed CSV entries.
    const updateAggregation = () => {
      const newBlocks = aggregateToBlocks(parsedEntries.value, idleThreshold.value)
      blocks.value = newBlocks
      const newWeeks = groupBlocksByWeek(newBlocks)
      weeks.value = newWeeks
      // Automatically select the latest week.
      if (newWeeks.length > 0) {
        const latestWeek = newWeeks.reduce((prev, curr) =>
          curr.weekStart > prev.weekStart ? curr : prev,
        )
        selectedWeekStart.value = latestWeek.weekStart.toISOString()
      }
      localStorage.setItem('worklogData', JSON.stringify({ blocks: newBlocks, weeks: newWeeks }))
    }

    // Handle CSV file drop.
    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer && event.dataTransfer.files.length) {
        const file = event.dataTransfer.files[0]
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result
          if (typeof text === 'string') {
            rawCsvText.value = text
            parsedEntries.value = parseCsv(text)
            updateAggregation()
          }
        }
        reader.readAsText(file)
      }
    }

    // Compute the selected week from weeks and the select value.
    const selectedWeek = ref<WeekData | null>(null)
    watch(
      [weeks, selectedWeekStart],
      () => {
        selectedWeek.value =
          weeks.value.find((week) => week.weekStart.toISOString() === selectedWeekStart.value) ||
          null
      },
      { immediate: true },
    )

    const formatDate = (date: Date) => {
      return date.toLocaleDateString()
    }

    return { idleThreshold, handleDrop, weeks, selectedWeek, selectedWeekStart, formatDate }
  },
})
</script>

<style scoped>
.app-container {
  font-family: Arial, sans-serif;
  max-width: 1000px;
  margin: 2rem auto;
  padding: 1rem;
}
h1 {
  text-align: center;
  margin-bottom: 1rem;
}
.config {
  margin-bottom: 1rem;
  text-align: center;
}
.drop-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: #666;
  transition: border-color 0.3s;
}
.drop-area:hover {
  border-color: #999;
}
.week-select {
  margin: 1rem 0;
  text-align: center;
}
.timetable {
  margin-top: 2rem;
}
</style>
