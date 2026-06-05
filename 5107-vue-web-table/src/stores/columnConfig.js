import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'
import { deepClone } from '@/utils'

export const useColumnConfigStore = defineStore('columnConfig', {
  state: () => ({
    configMap: {}
  }),

  getters: {
    getConfig: (state) => (tableKey) => {
      return state.configMap[tableKey] || null
    }
  },

  actions: {
    load(tableKey, defaultColumns) {
      const saved = storage.get(`columns_${tableKey}`)
      if (saved) {
        this.configMap[tableKey] = saved
        return this.mergeWithDefaults(saved, defaultColumns)
      }
      return deepClone(defaultColumns)
    },

    mergeWithDefaults(savedConfig, defaultColumns) {
      const result = deepClone(defaultColumns)
      
      savedConfig.forEach(savedCol => {
        const targetCol = result.find(c => c.prop === savedCol.prop)
        if (targetCol) {
          if (savedCol.width !== undefined) targetCol.width = savedCol.width
          if (savedCol.hidden !== undefined) targetCol.hidden = savedCol.hidden
          if (savedCol.order !== undefined) targetCol.order = savedCol.order
        }
      })
      
      if (savedConfig.some(col => col.order !== undefined)) {
        result.sort((a, b) => {
          const orderA = savedConfig.find(c => c.prop === a.prop)?.order ?? 9999
          const orderB = savedConfig.find(c => c.prop === b.prop)?.order ?? 9999
          return orderA - orderB
        })
      }
      
      return result
    },

    save(tableKey, columns) {
      const config = columns.map((col, index) => ({
        prop: col.prop,
        width: col.width,
        hidden: col.hidden || false,
        order: index
      }))
      this.configMap[tableKey] = config
      storage.set(`columns_${tableKey}`, config)
    },

    reset(tableKey) {
      delete this.configMap[tableKey]
      storage.remove(`columns_${tableKey}`)
    }
  }
})
