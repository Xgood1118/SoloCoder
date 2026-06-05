import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'

export const useSelectionStore = defineStore('selection', {
  state: () => ({
    selectionMap: new Map(),
    tableKey: '',
    idField: 'id'
  }),

  getters: {
    selectedCount: (state) => state.selectionMap.size,
    selectedIds: (state) => Array.from(state.selectionMap.keys()),
    selectedRows: (state) => Array.from(state.selectionMap.values()),
    isAllSelected: (state) => {
      return (pageRows) => {
        if (!pageRows || pageRows.length === 0) return false
        return pageRows.every(row => state.selectionMap.has(row[state.idField]))
      }
    },
    isIndeterminate: (state) => {
      return (pageRows) => {
        if (!pageRows || pageRows.length === 0) return false
        const selectedCount = pageRows.filter(row => state.selectionMap.has(row[state.idField])).length
        return selectedCount > 0 && selectedCount < pageRows.length
      }
    }
  },

  actions: {
    init(tableKey, idField = 'id') {
      this.tableKey = tableKey
      this.idField = idField
      const saved = storage.get(`selection_${tableKey}`)
      if (saved) {
        this.selectionMap = new Map(Object.entries(saved))
      }
    },

    isSelected(row) {
      return this.selectionMap.has(row[this.idField])
    },

    toggle(row) {
      const id = row[this.idField]
      if (this.selectionMap.has(id)) {
        this.selectionMap.delete(id)
      } else {
        this.selectionMap.set(id, { ...row })
      }
      this.save()
    },

    setSelected(row, selected) {
      const id = row[this.idField]
      if (selected) {
        this.selectionMap.set(id, { ...row })
      } else {
        this.selectionMap.delete(id)
      }
      this.save()
    },

    toggleAll(rows) {
      const allSelected = rows.every(row => this.selectionMap.has(row[this.idField]))
      if (allSelected) {
        rows.forEach(row => {
          this.selectionMap.delete(row[this.idField])
        })
      } else {
        rows.forEach(row => {
          this.selectionMap.set(row[this.idField], { ...row })
        })
      }
      this.save()
    },

    setAllSelected(rows, selected) {
      if (selected) {
        rows.forEach(row => {
          this.selectionMap.set(row[this.idField], { ...row })
        })
      } else {
        rows.forEach(row => {
          this.selectionMap.delete(row[this.idField])
        })
      }
      this.save()
    },

    clear() {
      this.selectionMap.clear()
      this.save()
    },

    removeByIds(ids) {
      ids.forEach(id => {
        this.selectionMap.delete(id)
      })
      this.save()
    },

    save() {
      const obj = Object.fromEntries(this.selectionMap)
      storage.set(`selection_${this.tableKey}`, obj)
    }
  }
})
