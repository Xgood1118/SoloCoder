import { Router, Request, Response } from "express";
import { ScheduleService } from "../services/ScheduleService";

const router = Router();
const getService = () => new ScheduleService();

router.get("/doctor/:doctorId", async (req: Request, res: Response) => {
  try {
    const { doctorId } = req.params;
    const service = getService();
    const schedules = await service.getDoctorSchedules(parseInt(doctorId));
    res.json({ success: true, data: schedules });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/doctor/:doctorId/weekly/:startDate", async (req: Request, res: Response) => {
  try {
    const { doctorId, startDate } = req.params;
    const service = getService();
    const schedules = await service.getWeeklySchedule(parseInt(doctorId), startDate);
    res.json({ success: true, data: schedules });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { doctorId, dayOfWeek, startTime, endTime, appointmentDuration, specificDate } = req.body;
    const service = getService();
    const schedule = await service.createSchedule(
      parseInt(doctorId),
      dayOfWeek,
      startTime,
      endTime,
      appointmentDuration || 30,
      specificDate
    );
    res.json({ success: true, data: schedule });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, specificDate } = req.body;
    const service = getService();
    const result = await service.cancelSchedule(parseInt(id), reason, specificDate);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = getService();
    await service.deleteSchedule(parseInt(id));
    res.json({ success: true, message: "排班已删除" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
