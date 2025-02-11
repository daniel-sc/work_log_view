<template>
  <div>
    <canvas ref="chartCanvas"></canvas>
    <div class="summary">
      <h3>Day Totals</h3>
      <ul>
        <li v-for="day in weekData.days" :key="day.date.toISOString()">
          {{ formatDate(day.date) }}: {{ formatDuration(day.totalDurationSec) }}
        </li>
      </ul>
      <h3>Week Total: {{ formatDuration(weekData.totalDurationSec) }}</h3>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch } from 'vue';
import { Chart } from 'chart.js/auto';
import { type WeekData } from '../aggregator';

export default defineComponent({
  name: 'TimeTable',
  props: {
    weekData: {
      type: Object as () => WeekData,
      required: true,
    }
  },
  setup(props) {
    const chartCanvas = ref<HTMLCanvasElement | null>(null);
    let chartInstance: Chart | null = null;

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date: Date) => {
      return date.toLocaleDateString();
    };

    const formatDuration = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      return `${h}h ${m}m ${s}s`;
    };

    // Flatten blocks from all days in the week into a single array.
    const getChartData = () => {
      const labels: string[] = [];
      const dataset1: number[] = [];
      const dataset2: number[] = [];
      const dataset1Labels: string[] = [];
      const dataset2Labels: string[] = [];
      // For each day and each block.
      props.weekData.days.forEach(day => {
        day.blocks.forEach(block => {
          const label = `${formatTime(block.from)} - ${formatTime(block.to)}`;
          labels.push(`${formatDate(day.date)} ${label}`);
          // Sort activities in descending order.
          const sorted = [...block.activities].sort((a, b) => b.durationSec - a.durationSec);
          const act1 = sorted[0] ? sorted[0] : { title: '', durationSec: 0 };
          const act2 = sorted[1] ? sorted[1] : { title: '', durationSec: 0 };
          dataset1.push(act1.durationSec);
          dataset2.push(act2.durationSec);
          dataset1Labels.push(act1.title);
          dataset2Labels.push(act2.title);
        });
      });
      return { labels, dataset1, dataset2, dataset1Labels, dataset2Labels };
    };

    const renderChart = () => {
      if (!chartCanvas.value) return;
      const ctx = chartCanvas.value.getContext('2d');
      if (!ctx) return;
      const { labels, dataset1, dataset2, dataset1Labels, dataset2Labels } = getChartData();
      if (chartInstance) {
        chartInstance.destroy();
      }
      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Top Activity',
              data: dataset1,
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
            },
            {
              label: 'Second Activity',
              data: dataset2,
              backgroundColor: 'rgba(153, 102, 255, 0.6)',
            }
          ]
        },
        options: {
          indexAxis: 'y',
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => {
                  const datasetIndex = context.datasetIndex;
                  const index = context.dataIndex;
                  const duration = context.parsed.x;
                  const activityLabel = datasetIndex === 0 ? dataset1Labels[index] : dataset2Labels[index];
                  return `${activityLabel}: ${duration}s`;
                }
              }
            }
          },
          responsive: true,
          scales: {
            x: {
              stacked: true,
              title: {
                display: true,
                text: 'Duration (sec)'
              }
            },
            y: {
              stacked: true,
            }
          }
        }
      });
    };

    onMounted(() => {
      renderChart();
    });

    watch(() => props.weekData, () => {
      renderChart();
    }, { deep: true });

    return { chartCanvas, formatDate, formatDuration };
  }
});
</script>

<style scoped>
.summary {
  margin-top: 1rem;
}
</style>
