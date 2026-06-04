import React, { useState, useEffect } from "react";
import {
  Table,
  Typography,
  Card,
  Tag,
  Button,
  Space,
  DatePicker,
  message,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import { appointmentApi } from "../api";
import { Appointment } from "../types";

const { Title } = Typography;

interface DoctorDashboardProps {
  doctorId: number;
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ doctorId }) => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, [doctorId, selectedDate]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await appointmentApi.getByDoctor(
        doctorId,
        selectedDate.format("YYYY-MM-DD")
      );
      setAppointments(res.data.data);
    } catch (error) {
      message.error("加载预约失败");
    } finally {
      setLoading(false);
    }
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
      "患者取消": { color: "orange", text: "患者取消" },
      "医生停诊": { color: "red", text: "医生停诊" },
    };
    const info = statusMap[status] || { color: "default", text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const pendingCount = appointments.filter((a) => a.status === "PENDING" || a.status === "待就诊").length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED" || a.status === "已完成").length;

  const columns = [
    {
      title: "序号",
      dataIndex: "queueNumber",
      key: "queueNumber",
      width: 80,
    },
    {
      title: "预约时间",
      dataIndex: "appointmentTime",
      key: "appointmentTime",
      width: 120,
    },
    {
      title: "患者姓名",
      key: "patientName",
      render: (_: any, record: Appointment) => record.patient?.name || `患者${record.patientId}`,
    },
    {
      title: "挂号方式",
      dataIndex: "bookingMode",
      key: "bookingMode",
      width: 120,
      render: (mode: string) => {
        const isOnline = mode === "线上挂号" || mode === "ONLINE";
        return <Tag color={isOnline ? "blue" : "green"}>{isOnline ? "线上挂号" : "现场挂号"}</Tag>;
      },
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
      render: (_: any, record: Appointment) => (
        <Space>
          {(record.status === "PENDING" || record.status === "待就诊") ? (
            <>
              <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => navigate(`/doctor/record/${record.id}`)}
              >
                接诊
              </Button>
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={async () => {
                  await appointmentApi.complete(record.id);
                  message.success("标记完成");
                  loadAppointments();
                }}
              >
                完成
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} className="page-title">
        <CalendarOutlined /> 今日排班
      </Title>

      <div style={{ marginBottom: 16 }}>
        <DatePicker
          value={selectedDate}
          onChange={setSelectedDate}
          style={{ width: 200 }}
        />
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日总预约"
              value={appointments.length}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待就诊"
              value={pendingCount}
              valueStyle={{ color: "#1890ff" }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已完成"
              value={completedCount}
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={appointments}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default DoctorDashboard;
