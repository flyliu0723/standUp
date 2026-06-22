<template>
  <div class="app-cat">
    <p class="app-cat__hint">
      调整非浏览器应用的分类，影响活动监测与软件统计。修改后请点击页面底部「保存设置」生效。浏览器按访问站点自动分类，此处不可修改。
    </p>

    <div class="app-cat__filters">
      <n-input
        v-model:value="filterState.keyword"
        clearable
        placeholder="搜索应用名或进程名"
        size="small"
      />
      <n-select
        v-model:value="filterState.source"
        :options="sourceOptions"
        size="small"
        class="app-cat__source"
      />
      <n-checkbox v-model:checked="filterState.onlyCustomized">
        仅看已自定义
      </n-checkbox>
    </div>

    <n-data-table
      class="app-cat__table"
      :columns="columns"
      :data="tableData"
      :bordered="false"
      size="small"
      :max-height="360"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NCheckbox, NDataTable, NInput, NSelect, type DataTableColumns } from 'naive-ui'
import type { AppCategory, AppCategoryConfigItem } from '@/types/session'
import {
  APP_CATEGORY_LABELS,
  APP_CATEGORY_OPTIONS
} from '@/utils/appUsage'

const props = defineProps<{
  overrides: Record<string, AppCategory>
}>()

const emit = defineEmits<{
  'update:overrides': [value: Record<string, AppCategory>]
}>()

const catalog = ref<AppCategoryConfigItem[]>([])

const filterState = reactive({
  keyword: '',
  source: 'all' as 'all' | 'builtin' | 'observed',
  onlyCustomized: false
})

const sourceOptions = [
  { value: 'all', label: '全部来源' },
  { value: 'builtin', label: '内置应用' },
  { value: 'observed', label: '曾使用过' }
]

const tableData = computed(() => {
  const keyword = filterState.keyword.trim().toLowerCase()
  return catalog.value
    .map((item) => {
      const effectiveCategory = item.categoryEditable
        ? props.overrides[item.processName] ?? item.defaultCategory
        : item.defaultCategory
      const isOverridden =
        item.categoryEditable && props.overrides[item.processName] !== undefined
      return {
        ...item,
        effectiveCategory,
        isOverridden
      }
    })
    .filter((item) => {
      if (filterState.source !== 'all' && item.source !== filterState.source) {
        return false
      }
      if (filterState.onlyCustomized && !item.isOverridden) {
        return false
      }
      if (!keyword) {
        return true
      }
      return (
        item.label.toLowerCase().includes(keyword) ||
        item.processName.toLowerCase().includes(keyword)
      )
    })
})

async function fetchList(): Promise<void> {
  try {
    catalog.value = await window.standUp.getAppCategoryList()
  } catch {
    catalog.value = []
  }
}

function updateCategory(processName: string, category: AppCategory, defaultCategory: AppCategory): void {
  const next = { ...props.overrides }
  if (category === defaultCategory) {
    delete next[processName]
  } else {
    next[processName] = category
  }
  emit('update:overrides', next)
}

function resetCategory(processName: string): void {
  const next = { ...props.overrides }
  delete next[processName]
  emit('update:overrides', next)
}

const columns = computed<DataTableColumns>(() => [
  {
    title: '应用',
    key: 'label',
    minWidth: 120,
    ellipsis: { tooltip: true }
  },
  {
    title: '进程',
    key: 'processName',
    minWidth: 120,
    ellipsis: { tooltip: true }
  },
  {
    title: '默认',
    key: 'defaultCategory',
    width: 72,
    render: (row) => APP_CATEGORY_LABELS[row.defaultCategory as AppCategory]
  },
  {
    title: '当前类型',
    key: 'effectiveCategory',
    width: 120,
    render: (row) => {
      if (!row.categoryEditable) {
        return h('span', { class: 'app-cat__site-hint' }, '按站点')
      }
      return h(NSelect, {
        size: 'small',
        value: row.effectiveCategory,
        options: APP_CATEGORY_OPTIONS,
        onUpdateValue: (value: AppCategory) =>
          updateCategory(row.processName, value, row.defaultCategory)
      })
    }
  },
  {
    title: '来源',
    key: 'source',
    width: 80,
    render: (row) => (row.source === 'builtin' ? '内置' : '使用过')
  },
  {
    title: '操作',
    key: 'actions',
    width: 72,
    render: (row) => {
      if (!row.categoryEditable || !row.isOverridden) {
        return '—'
      }
      return h(
        NButton,
        {
          size: 'tiny',
          quaternary: true,
          onClick: () => resetCategory(row.processName)
        },
        { default: () => '恢复' }
      )
    }
  }
])

onMounted(() => {
  fetchList()
})
</script>

<style lang="scss" scoped>
.app-cat {
  &__hint {
    margin: 12px 0;
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.55;
  }

  &__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  &__source {
    width: 120px;
  }

  &__table {
    :deep(.n-data-table-th) {
      font-size: 12px;
    }

    :deep(.n-data-table-td) {
      font-size: 12px;
    }
  }

  &__site-hint {
    font-size: 12px;
    color: #6366f1;
  }
}
</style>
