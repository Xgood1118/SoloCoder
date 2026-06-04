import React, { useState, useEffect } from "react";
import {
  Table,
  Typography,
  Card,
  Descriptions,
  Modal,
  message,
  Tag,
} from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { medicalRecordApi } from "../api";
import { MedicalRecord } from "../types";

const { Title } = Typography;

interface PatientRecordsProps {
  patientId: number;
}

const PatientRecords: React.FC<PatientRecordsProps> = ({ patientId }) => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    loadRecords();
  }, [patientId]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await medicalRecordApi.getByPatient(patientId);
      setRecords(res.data.data);
    } catch (error) {
      message.error("加载就诊记录失败");
    } finally {
      setLoading(false);
    }
  };

  const viewRecord = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setModalVisible(true);
  };

  const columns = [
    {
      title: "就诊日期",
      dataIndex: "visitDate",
      key: "visitDate",
    },
    {
      title: "病历编号",
      dataIndex: "recordNo",
      key: "recordNo",
    },
    {
      title: "主诉",
      dataIndex: "chiefComplaint",
      key: "chiefComplaint",
      ellipsis: true,
    },
    {
      title: "诊断",
      dataIndex: "diagnosis",
      key: "diagnosis",
      ellipsis: true,
    },
    {
      title: "处方数量",
      key: "prescriptions",
      render: (_: any, record: MedicalRecord) => (
        <Tag color="blue">{record.prescriptions?.length || 0} 张</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: MedicalRecord) => (
        <a onClick={() => viewRecord(record)}>查看详情</a>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} className="page-title">
        <FileTextOutlined /> 就诊记录
      </Title>
      <Card>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="病历详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="病历编号">
              {selectedRecord.recordNo}
            </Descriptions.Item>
            <Descriptions.Item label="就诊日期">
              {selectedRecord.visitDate}
            </Descriptions.Item>
            <Descriptions.Item label="主诉">
              {selectedRecord.chiefComplaint || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="现病史">
              {selectedRecord.presentIllness || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="诊断">
              {selectedRecord.diagnosis || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="治疗方案">
              {selectedRecord.treatmentPlan || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="医嘱">
              {selectedRecord.doctorAdvice || "-"}
            </Descriptions.Item>
            {selectedRecord.prescriptions && selectedRecord.prescriptions.length > 0 && (
              <Descriptions.Item label="处方">
                {selectedRecord.prescriptions.map((p, idx) => (
                  <div key={p.id} style={{ marginBottom: 8 }}>
                    <strong>处方 {idx + 1}:</strong>
                    <ul>
                      {p.items?.map((item) => (
                        <li key={item.id}>
                          {item.medicineName} {item.specification} × {item.quantity}
                          {item.dosage && ` - ${item.dosage}`}
                          {item.frequency && ` ${item.frequency}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default PatientRecords;
