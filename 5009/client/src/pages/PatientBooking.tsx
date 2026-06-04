import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Select,
  DatePicker,
  TimePicker,
  Button,
  Typography,
  message,
  List,
  Tag,
} from "antd";
import { CalendarOutlined, UserOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import {
  departmentApi,
  doctorApi,
  scheduleApi,
  appointmentApi,
} from "../api";
import { Department, Doctor } from "../types";

const { Title, Text } = Typography;
const { Option } = Select;

interface PatientBookingProps {
  patientId: number;
}

const PatientBooking: React.FC<PatientBookingProps> = ({ patientId }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [availableSlots, setAvailableSlots] = useState<
    Array<{ time: string; available: boolean }>
  >([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const res = await departmentApi.getAll();
      setDepartments(res.data.data);
    } catch (error) {
      message.error("加载科室失败");
    }
  };

  const handleDeptChange = async (deptId: number) => {
    setSelectedDept(deptId);
    setSelectedDoctor(null);
    setSelectedDate(null);
    setAvailableSlots([]);
    try {
      const res = await doctorApi.getByDepartment(deptId);
      setDoctors(res.data.data);
    } catch (error) {
      message.error("加载医生失败");
    }
  };

  const handleDoctorChange = async (doctorId: number) => {
    setSelectedDoctor(doctorId);
    setSelectedDate(null);
    setAvailableSlots([]);
    try {
      const res = await scheduleApi.getByDoctor(doctorId);
      if (res.data.data.length > 0) {
        setSelectedScheduleId(res.data.data[0].id);
      }
    } catch (error) {
      message.error("加载排班失败");
    }
  };

  const handleDateChange = async (date: Dayjs | null) => {
    setSelectedDate(date);
    if (date && selectedDoctor) {
      try {
        const res = await appointmentApi.getSlots(
          selectedDoctor,
          date.format("YYYY-MM-DD")
        );
        setAvailableSlots(res.data.data);
      } catch (error) {
        message.error("加载号源失败");
      }
    }
  };

  const handleBooking = async (time: string) => {
    if (!selectedDoctor || !selectedDate || !selectedScheduleId) {
      message.error("请完善预约信息");
      return;
    }

    setLoading(true);
    try {
      await appointmentApi.create({
        patientId,
        doctorId: selectedDoctor,
        scheduleId: selectedScheduleId,
        appointmentDate: selectedDate.format("YYYY-MM-DD"),
        appointmentTime: time,
        bookingMode: "ONLINE",
      });
      message.success("预约成功！");
      handleDateChange(selectedDate);
    } catch (error: any) {
      message.error(error.response?.data?.message || "预约失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={2} className="page-title">
        <CalendarOutlined /> 预约挂号
      </Title>

      <Row gutter={24}>
        <Col span={12}>
          <Card title="选择预约信息" className="card-container">
            <div style={{ marginBottom: 16 }}>
              <Text strong>选择科室：</Text>
              <Select
                style={{ width: "100%", marginTop: 8 }}
                placeholder="请选择科室"
                onChange={handleDeptChange}
                value={selectedDept || undefined}
              >
                {departments.map((dept) => (
                  <Option key={dept.id} value={dept.id}>
                    {dept.name} - 挂号费¥{dept.baseRegistrationFee}起
                  </Option>
                ))}
              </Select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>选择医生：</Text>
              <Select
                style={{ width: "100%", marginTop: 8 }}
                placeholder="请选择医生"
                onChange={handleDoctorChange}
                value={selectedDoctor || undefined}
                disabled={!selectedDept}
              >
                {doctors.map((doctor) => (
                  <Option key={doctor.id} value={doctor.id}>
                    {doctor.name} - {doctor.title}（{doctor.specialty}）
                  </Option>
                ))}
              </Select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>选择日期：</Text>
              <DatePicker
                style={{ width: "100%", marginTop: 8 }}
                disabledDate={(current) =>
                  current && current < dayjs().startOf("day")
                }
                onChange={handleDateChange}
                value={selectedDate}
                disabled={!selectedDoctor}
              />
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="可选号源" className="card-container">
            {availableSlots.length === 0 ? (
              <Text type="secondary">
                {selectedDate
                  ? "该日期暂无号源，请选择其他日期"
                  : "请先选择医生和日期"}
              </Text>
            ) : (
              <List
                grid={{ gutter: 8, column: 4 }}
                dataSource={availableSlots}
                renderItem={(slot) => (
                  <List.Item>
                    <Button
                      type={slot.available ? "default" : "default"}
                      disabled={!slot.available || loading}
                      onClick={() => handleBooking(slot.time)}
                      style={{
                        width: "100%",
                        background: slot.available ? "#fff" : "#f5f5f5",
                        borderColor: slot.available ? "#1890ff" : "#d9d9d9",
                        color: slot.available ? "#1890ff" : "#999",
                      }}
                    >
                      {slot.time}
                      {!slot.available && <Tag color="red">已满</Tag>}
                    </Button>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PatientBooking;
