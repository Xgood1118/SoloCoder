import * as XLSX from 'xlsx'

export const exportToExcel = (columns, data, filename = 'export') => {
  const exportColumns = columns.filter(col => !col.hidden)
  
  const headers = exportColumns.map(col => col.label || col.prop)
  const headerRow = [headers]
  
  const dataRows = data.map(row => {
    return exportColumns.map(col => {
      let value = row[col.prop]
      if (col.formatter) {
        value = col.formatter(row, col, value)
      }
      if (value === null || value === undefined) {
        return ''
      }
      if (typeof value === 'object' && value instanceof Date) {
        return value.toISOString()
      }
      return value
    })
  })
  
  const wsData = [...headerRow, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  
  const colWidths = exportColumns.map((col, index) => {
    const maxLen = Math.max(
      headers[index].length,
      ...dataRows.map(row => String(row[index] || '').length)
    )
    return { wch: Math.min(maxLen + 2, 50) }
  })
  ws['!cols'] = colWidths
  
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  
  const timestamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`)
}

export const exportSelectedToExcel = (columns, selectedRows, filename = 'selected_export') => {
  return exportToExcel(columns, selectedRows, filename)
}
