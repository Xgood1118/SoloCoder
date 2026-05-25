import React, { useState, useRef } from 'react'
import { Modal, Upload, Button, message, Alert, Table, Tag, Space } from 'antd'
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useUserStore } from '../stores/userStore'
import { downloadFile } from '../utils/helpers'
import { ImportResult } from '../types'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ImportRow {
  key: number
  name: string
  employeeId: string
  phone: string
  email: string
  departmentName: string
  position: string
  hireDate: string
  error?: string
}

const ImportDialog: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const { importUsers, departments } = useUserStore()
  const [importing, setImporting] = useState(false)
  const [previewData, setPreviewData] = useState<ImportRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    const template = [
      ['姓名', '工号', '手机号', '邮箱', '部门', '职位', '入职日期'],
      ['张三', '2024001', '13800138001', 'zhangsan@company.com', '技术部', '工程师', '2024-01-01'],
    ]
    const csvContent = template.map((row) => row.join(',')).join('\n')
    downloadFile(csvContent, '用户导入模板.csv', 'text/csv')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        if (!data) return

        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

        const rows: ImportRow[] = jsonData.map((item, index) => ({
          key: index,
          name: item['姓名'] || item['name'] || '',
          employeeId: item['工号'] || item['employeeId'] || '',
          phone: item['手机号'] || item['phone'] || '',
          email: item['邮箱'] || item['email'] || '',
          departmentName: item['部门'] || item['department'] || item['departmentName'] || '',
          position: item['职位'] || item['position'] || '',
          hireDate: item['入职日期'] || item['hireDate'] || '',
        }))

        setPreviewData(rows)
        setImportResult(null)
      } catch {
        message.error('文件解析失败，请检查文件格式')
      }
    }
    reader.readAsBinaryString(file)
  }

  const getDepartmentId = (deptName: string): string | undefined => {
    const findDept = (depts: any[]): string | undefined => {
      for (const dept of depts) {
        if (dept.name === deptName) {
          return dept.id
        }
        if (dept.children) {
          const found = findDept(dept.children)
          if (found) return found
        }
      }
      return undefined
    }
    return findDept(departments)
  }

  const handleImport = async () => {
    if (previewData.length === 0) {
      message.warning('请先上传文件')
      return
    }

    setImporting(true)

    const usersToImport = previewData.map((row) => {
      const deptId = getDepartmentId(row.departmentName)
      return {
        name: row.name,
        employeeId: row.employeeId,
        phone: row.phone,
        email: row.email,
        departmentId: deptId,
        departmentName: row.departmentName,
        position: row.position,
        hireDate: row.hireDate,
        roles: [],
      }
    })

    const result = importUsers(usersToImport)
    setImportResult(result)

    if (result.failed > 0) {
      setPreviewData((prev) =>
        prev.map((row, index) => ({
          ...row,
          error: result.errors[index]?.split('：')[1] || '导入失败',
        }))
      )
    }

    setImporting(false)

    if (result.success > 0) {
      message.success(`成功导入 ${result.success} 条数据`)
      setTimeout(() => {
        onSuccess()
      }, 1500)
    }
  }

  const handleClose = () => {
    setPreviewData([])
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  const previewColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '工号', dataIndex: 'employeeId', key: 'employeeId' },
    { title: '手机号', dataIndex: 'phone', key: 'phone' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '部门', dataIndex: 'departmentName', key: 'departmentName' },
    { title: '职位', dataIndex: 'position', key: 'position' },
    { title: '入职日期', dataIndex: 'hireDate', key: 'hireDate' },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: ImportRow) =>
        record.error ? <Tag color="red">失败: {record.error}</Tag> : <Tag color="green">待导入</Tag>,
    },
  ]

  return (
    <Modal
      title="批量导入用户"
      open={visible}
      onCancel={handleClose}
      onOk={handleImport}
      confirmLoading={importing}
      okText="开始导入"
      width={800}
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          message="导入说明"
          description={
            <ul style={{ marginBottom: 0 }}>
              <li>支持 CSV、Excel 格式文件</li>
              <li>请先下载模板，按照模板格式填写数据</li>
              <li>姓名和手机号同时存在时判定为重复</li>
              <li>工号和手机号必须唯一</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载模板
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="import-file-input"
          />
          <label htmlFor="import-file-input">
            <Button icon={<UploadOutlined />}>
              选择文件
            </Button>
          </label>
        </Space>
      </div>

      {previewData.length > 0 && (
        <div className="import-result">
          <div style={{ marginBottom: 8 }}>
            共 {previewData.length} 条数据待导入
          </div>
          <Table
            columns={previewColumns}
            dataSource={previewData}
            rowKey="key"
            pagination={{ pageSize: 5 }}
            size="small"
            scroll={{ y: 300 }}
          />
        </div>
      )}

      {importResult && (
        <Alert
          style={{ marginTop: 16 }}
          message={`导入完成：成功 ${importResult.success} 条，失败 ${importResult.failed} 条`}
          type={importResult.failed > 0 ? 'warning' : 'success'}
          showIcon
        />
      )}
    </Modal>
  )
}

export default ImportDialog
