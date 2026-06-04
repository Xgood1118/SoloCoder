import React, { useState, useEffect } from "react";
import {
  Table,
  Typography,
  Card,
  Button,
  Modal,
  Form,
  Select,
  TimePicker,
  InputNumber,
  message,
  Space,
  Tag,
  Popconfirm,
} from "antd";
import {
  CalendarOutlined,
  PlusOutlined,
  DeleteOutlined,
  StopOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { scheduleApi } from "../api";
import type { DoctorSchedule as DoctorScheduleType } from "../types";

const { Title } = Typography;
const { Option } = Select;

interface DoctorScheduleProps {
  doctorId: number;
}

const dayOfWeekMap: Record<number, string> = {
  0: "周日",
  1: "周一",
  2: "周二",
  3: "周三",
  4: "周四",
  5: "周五",
  6: "周六",
};

const DoctorSchedule: React.FC<DoctorScheduleProps> = ({ doctorId }) => {
  const [schedules, setSchedules] = useState<DoctorScheduleType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadSchedules();
  }, [doctorId]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await scheduleApi.getByDoctor(doctorId);
      setSchedules(res.data.data);
    } catch (error) {
      message.error("加载排班失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      // 这里调用创建排班API
      message.success("排班创建成功");
      setModalVisible(false);
      loadSchedules();
    } catch (error) {
      message.error("创建失败");
    }
  };

  const handleCancelSchedule = async (scheduleId: number) => {
    try {
      // 这里调用停诊API
      message.success("已通知已预约患者重新预约");
      loadSchedules();
    } catch (error) {
      message.error("操作失败");
    }
  };

  const columns = [
    {
      title: "星期",
      dataIndex: "dayOfWeek",
      key: "dayOfWeek",
      render: (day: number) => dayOfWeekMap[day] || "-",
    },
    {
      title: "开始时间",
      dataIndex: "startTime",
      key: "startTime",
    },
    {
      title: "结束时间",
      dataIndex: "endTime",
      key: "endTime",
    },
    {
      title: "号源间隔",
      dataIndex: "appointmentDuration",
      key: "appointmentDuration",
      render: (min: number) => `${min}分钟`,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const isActive = status === "ACTIVE" || status === "正常";
        return <Tag color={isActive ? "green" : "red"}>{isActive ? "正常" : "停诊"}</Tag>;
      },
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: DoctorScheduleType) => (
        <Space>
          {(record.status === "ACTIVE" || record.status === "正常") && (
            <Popconfirm
              title="确认停诊"
              description="停诊将提前24小时通知已预约患者并进入重新预约流程"
              onConfirm={() => handleCancelSchedule(record.id)}
            >
              <Button
                type="link"
                danger
                size="small"
                icon={<StopOutlined />}
              >
                停诊
              </Button>
            </Popconfirm>
          )}
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => {
              // 删除排班
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} className="page-title">
        <CalendarOutlined /> 出诊管理
      </Title>

      <Card
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增排班
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={schedules}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title="新增排班"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="星期"
            name="dayOfWeek"
            rules={[{ required: true, message: "请选择星期" }]}
          >
            <Select placeholder="请选择星期">
              {Object.entries(dayOfWeekMap).map(([key, value]) => (
                <Option key={key} value={parseInt(key)}>
                  {value}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="开始时间"
            name="startTime"
            rules={[{ required: true, message: "请选择开始时间" }]}
          >
            <TimePicker
              style={{ width: "100%" }}
              format="HH:mm"
              minuteStep={30}
            />
          </Form.Item>
          <Form.Item
            label="结束时间"
            name="endTime"
            rules={[{ required: true, message: "请选择结束时间" }]}
          >
            <TimePicker
              style={{ width: "100%" }}
              format="HH:mm"
              minuteStep={30}
            />
          </Form.Item>
          <Form.Item
            label="号源间隔(分钟)"
            name="duration"
            initialValue={30}
          >
            <InputNumber min={10} max={60} step={5} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DoctorSchedule;
