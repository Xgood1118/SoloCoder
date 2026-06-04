import React, { useState, useEffect } from "react";
import { Table, Typography, Tag, Button, Modal, message, Card } from "antd";
import { CalendarOutlined, DeleteOutlined } from "@ant-design/icons";
import { appointmentApi } from "../api";
import { Appointment } from "../types";

const { Title, Text } = Typography;
const { confirm } = Modal;

interface PatientAppointmentsProps {
  patientId: number;
}

const PatientAppointments: React.FC<PatientAppointmentsProps> = ({ patientId }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, [patientId]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await appointmentApi.getByPatient(patientId);
      setAppointments(res.data.data);
    } catch (error) {
      message.error("加载预约失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (record: Appointment) => {
    confirm({
      title: "确认取消预约",
      content: `确定要取消 ${record.appointmentDate} ${record.appointmentTime} 的预约吗？
      
注意：
- 提前24小时以上取消：不扣除信用积分
- 24小时内取消：扣除5个信用积分
- 当天取消：扣除10个信用积分，并记为一次违约`,
      onOk: async () => {
        try {
          await appointmentApi.cancel(record.id, "患者主动取消");
          message.success("取消成功");
          loadAppointments();
        } catch (error: any) {
          message.error(error.response?.data?.message || "取消失败");
        }
      },
    });
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      PENDING: { color: "blue", text: "待就诊" },
      COMPLETED: { color: "green", text: "已完成" },
      CANCELLED_BY_PATIENT: { color: "orange", text: "患者取消" },
      CANCELLED_BY_DOCTOR: { color: "red", text: "医生停诊" },
      NO_SHOW: { color: "volcano", text: "爽约" },
      RESCHEDULED: { color: "purple", text: "已改期" },
      "待就诊": { color: "blue", text: "待就诊" },
      "已完成": { color: "green", text: "已完成" },
      "患者取消": { color: "orange", text: "已取消" },
      "医生停诊": { color: "red", text: "医生停诊" },
      "爽约": { color: "red", text: "爽约" },
    };
    const info = statusMap[status] || { color: "default", text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const columns = [
    {
      title: "预约编号",
      dataIndex: "appointmentNo",
      key: "appointmentNo",
    },
    {
      title: "医生",
      dataIndex: ["doctor", "name"],
      key: "doctorName",
      render: (_: any, record: Appointment) => record.doctor?.name || "-",
    },
    {
      title: "科室",
      dataIndex: ["doctor", "department", "name"],
      key: "department",
      render: (_: any, record: Appointment) => record.doctor?.department?.name || "-",
    },
    {
      title: "预约日期",
      dataIndex: "appointmentDate",
      key: "appointmentDate",
    },
    {
      title: "预约时间",
      dataIndex: "appointmentTime",
      key: "appointmentTime",
    },
    {
      title: "挂号费",
      key: "fee",
      render: (_: any, record: Appointment) => (
        <div>
          <Text delete>¥{record.originalFee}</Text>
          <Text strong style={{ marginLeft: 8, color: "#f5222d" }}>
            ¥{record.actualFee}
          </Text>
          {record.discountApplied > 0 && (
            <Tag color="green">优惠{record.discountApplied}%</Tag>
          )}
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => getStatusTag(status),
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: Appointment) =>
        record.status === "PENDING" || record.status === "待就诊" ? (
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleCancel(record)}
          >
            取消预约
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <Title level={2} className="page-title">
        <CalendarOutlined /> 我的预约
      </Title>
      <Card>
        <Table
          columns={columns}
          dataSource={appointments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default PatientAppointments;
