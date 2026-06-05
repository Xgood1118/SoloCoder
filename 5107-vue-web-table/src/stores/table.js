import { defineStore } from 'pinia'

export const useTableStore = defineStore('table', {
  state: () => ({
    tables: {}
  }),

  getters: {
    getTableState: (state) => (tableKey) => {
      return state.tables[tableKey] || null
    }
  },

  actions: {
    init(tableKey, initialState = {}) {
      if (!this.tables[tableKey]) {
        this.tables[tableKey] = {
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0
          },
          sorts: [],
          filters: {},
          ...initialState
        }
      }
      return this.tables[tableKey]
    },

    updatePagination(tableKey, pagination) {
      if (this.tables[tableKey]) {
        this.tables[tableKey].pagination = {
          ...this.tables[tableKey].pagination,
          ...pagination
        }
      }
    },

    updateSorts(tableKey, sorts) {
      if (this.tables[tableKey]) {
        this.tables[tableKey].sorts = sorts
      }
    },

    updateFilters(tableKey, filters) {
      if (this.tables[tableKey]) {
        this.tables[tableKey].filters = filters
      }
    },

    reset(tableKey) {
      if (this.tables[tableKey]) {
        this.tables[tableKey] = {
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0
          },
          sorts: [],
          filters: {}
        }
      }
    }
  }
})
