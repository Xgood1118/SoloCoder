import { Router, Request, Response } from "express";
import { AppointmentService } from "../services/AppointmentService";
import { BookingMode } from "../entities/Appointment";

const router = Router();
const getService = () => new AppointmentService();

router.get("/available/:doctorId/:date", async (req: Request, res: Response) => {
  try {
    const { doctorId, date } = req.params;
    const service = getService();
    const slots = await service.getAvailableTimeSlots(parseInt(doctorId), date);
    res.json({ success: true, data: slots });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { patientId, doctorId, scheduleId, appointmentDate, appointmentTime, bookingMode } = req.body;
    const service = getService();
    const appointment = await service.createAppointment(
      parseInt(patientId),
      parseInt(doctorId),
      parseInt(scheduleId),
      appointmentDate,
      appointmentTime,
      bookingMode || BookingMode.ONLINE
    );
    res.json({ success: true, data: appointment });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const service = getService();
    const appointment = await service.cancelAppointment(parseInt(id), reason);
    res.json({ success: true, data: appointment });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/complete", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = getService();
    const appointment = await service.completeAppointment(parseInt(id));
    res.json({ success: true, data: appointment });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { status } = req.query;
    const service = getService();
    const appointments = await service.getPatientAppointments(
      parseInt(patientId),
      status as any
    );
    res.json({ success: true, data: appointments });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/doctor/:doctorId", async (req: Request, res: Response) => {
  try {
    const { doctorId } = req.params;
    const { date, status } = req.query;
    const service = getService();
    const appointments = await service.getDoctorAppointments(
      parseInt(doctorId),
      date as string,
      status as any
    );
    res.json({ success: true, data: appointments });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
