import "reflect-metadata";
import express from "express";
import cors from "cors";
import { initializeDataSource } from "./data-source";
import appointmentRoutes from "./routes/appointments";
import scheduleRoutes from "./routes/schedules";
import medicalRecordRoutes from "./routes/medicalRecords";
import prescriptionRoutes from "./routes/prescriptions";
import doctorRoutes from "./routes/doctors";
import patientRoutes from "./routes/patients";
import departmentRoutes from "./routes/departments";
import medicineRoutes from "./routes/medicines";
import notificationRoutes from "./routes/notifications";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/appointments", appointmentRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/medical-records", medicalRecordRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "医院挂号管理系统API运行正常" });
});

async function startServer() {
  try {
    await initializeDataSource();
    console.log("数据库连接成功");
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("数据库连接失败:", error);
    process.exit(1);
  }
}

startServer();

export default app;
