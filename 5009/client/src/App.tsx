import React, { useState } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { Layout, Menu, Dropdown, Avatar, Badge } from "antd";
import {
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  BellOutlined,
  SolutionOutlined,
} from "@ant-design/icons";
import Home from "./pages/Home";
import PatientBooking from "./pages/PatientBooking";
import PatientAppointments from "./pages/PatientAppointments";
import PatientRecords from "./pages/PatientRecords";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorSchedule from "./pages/DoctorSchedule";
import DoctorMedicalRecord from "./pages/DoctorMedicalRecord";

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<"patient" | "doctor">("patient");
  const [currentPatientId] = useState(1);
  const [currentDoctorId] = useState(1);

  const patientMenuItems = [
    {
      key: "1",
      icon: <CalendarOutlined />,
      label: <Link to="/">预约挂号</Link>,
    },
    {
      key: "2",
      icon: <FileTextOutlined />,
      label: <Link to="/appointments">我的预约</Link>,
    },
    {
      key: "3",
      icon: <MedicineBoxOutlined />,
      label: <Link to="/records">就诊记录</Link>,
    },
  ];

  const doctorMenuItems = [
    {
      key: "1",
      icon: <CalendarOutlined />,
      label: <Link to="/doctor">今日排班</Link>,
    },
    {
      key: "2",
      icon: <SolutionOutlined />,
      label: <Link to="/doctor/schedule">出诊管理</Link>,
    },
  ];

  const userMenu = (
    <Menu
      items={[
        {
          key: "1",
          label: userRole === "patient" ? "切换为医生端" : "切换为患者端",
          onClick: () =>
            setUserRole(userRole === "patient" ? "doctor" : "patient"),
        },
      ]}
    />
  );

  return (
    <Layout className="layout">
      <Header style={{ display: "flex", alignItems: "center" }}>
        <div className="logo">医院挂号系统</div>
        <div style={{ flex: 1 }} />
        <Badge count={5} style={{ marginRight: 20 }}>
          <BellOutlined style={{ fontSize: 20, color: "white" }} />
        </Badge>
        <Dropdown overlay={userMenu}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar icon={<UserOutlined />} />
            <span style={{ color: "white" }}>
              {userRole === "patient" ? "患者甲" : "张医生"}
            </span>
          </div>
        </Dropdown>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: "#fff" }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={["1"]}
            style={{ height: "100%", borderRight: 0 }}
            items={userRole === "patient" ? patientMenuItems : doctorMenuItems}
          />
        </Sider>
        <Layout style={{ padding: "0 24px 24px" }}>
          <Content
            className="site-layout-content"
            style={{
              background: "#fff",
              margin: "24px 0",
              minHeight: 280,
            }}
          >
            <Routes>
              <Route path="/" element={<PatientBooking patientId={currentPatientId} />} />
              <Route path="/appointments" element={<PatientAppointments patientId={currentPatientId} />} />
              <Route path="/records" element={<PatientRecords patientId={currentPatientId} />} />
              <Route path="/doctor" element={<DoctorDashboard doctorId={currentDoctorId} />} />
              <Route path="/doctor/schedule" element={<DoctorSchedule doctorId={currentDoctorId} />} />
              <Route path="/doctor/record/:appointmentId" element={<DoctorMedicalRecord />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;
