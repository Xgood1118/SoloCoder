import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  directoriesAPI,
  rulesAPI,
  queueAPI,
  recordsAPI,
  settingsAPI,
} from '../api';

export const useAppStore = defineStore('app', () => {
  const directories = ref([]);
  const rules = ref([]);
  const ruleRelation = ref('any');
  const queueInfo = ref({
    queueSize: 0,
    maxQueueSize: 100,
    isPaused: false,
    currentFile: null,
    currentProgress: 0,
    currentElapsed: 0,
    queuedFiles: [],
    retryItems: [],
  });
  const latestRecords = ref([]);
  const stats = ref({
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    retrying: 0,
  });
  const settings = ref({});

  const activeDirectories = computed(() =>
    directories.value.filter((d) => d.status === 'active')
  );

  const errorDirectories = computed(() =>
    directories.value.filter((d) => d.status === 'error')
  );

  async function fetchInitialData() {
    try {
      const [dirRes, rulesRes, queueRes, statsRes, settingsRes] = await Promise.all([
        directoriesAPI.list(),
        rulesAPI.list(),
        queueAPI.get(),
        recordsAPI.stats(),
        settingsAPI.get(),
      ]);

      if (dirRes.success) directories.value = dirRes.data;
      if (rulesRes.success) {
        rules.value = rulesRes.data.rules;
        ruleRelation.value = rulesRes.data.relation;
      }
      if (queueRes.success) {
        queueInfo.value = { ...queueInfo.value, ...queueRes.data };
      }
      if (statsRes.success) stats.value = statsRes.data;
      if (settingsRes.success) settings.value = settingsRes.data;
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  }

  function handleSSEEvent(event) {
    switch (event.type) {
      case 'queue':
        queueInfo.value = { ...queueInfo.value, ...event.data };
        break;
      case 'directories':
        directories.value = event.data;
        break;
      case 'record':
        latestRecords.value = [event.data, ...latestRecords.value].slice(0, 100);
        updateStatsWithRecord(event.data);
        break;
    }
  }

  function updateStatsWithRecord(record) {
    stats.value.total++;
    if (record.result === 'success') stats.value.success++;
    else if (record.result === 'failed') stats.value.failed++;
    else if (record.result === 'skipped') stats.value.skipped++;
    else if (record.result === 'retrying') stats.value.retrying++;
  }

  async function refreshDirectories() {
    const res = await directoriesAPI.list();
    if (res.success) directories.value = res.data;
  }

  async function refreshRules() {
    const res = await rulesAPI.list();
    if (res.success) {
      rules.value = res.data.rules;
      ruleRelation.value = res.data.relation;
    }
  }

  async function refreshQueue() {
    const res = await queueAPI.get();
    if (res.success) {
      queueInfo.value = { ...queueInfo.value, ...res.data };
    }
  }

  async function refreshStats(params) {
    const res = await recordsAPI.stats(params);
    if (res.success) stats.value = res.data;
  }

  return {
    directories,
    rules,
    ruleRelation,
    queueInfo,
    latestRecords,
    stats,
    settings,
    activeDirectories,
    errorDirectories,
    fetchInitialData,
    handleSSEEvent,
    refreshDirectories,
    refreshRules,
    refreshQueue,
    refreshStats,
  };
});
