import { Router, Request, Response } from "express";
import { MedicalRecordService } from "../services/MedicalRecordService";

const router = Router();
const getService = () => new MedicalRecordService();

router.get("/appointment/:appointmentId", async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const service = getService();
    const record = await service.getAppointmentMedicalRecord(parseInt(appointmentId));
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const service = getService();
    const records = await service.getPatientMedicalRecords(parseInt(patientId));
    res.json({ success: true, data: records });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = getService();
    const record = await service.getMedicalRecord(parseInt(id));
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { appointmentId, ...data } = req.body;
    const service = getService();
    const record = await service.createMedicalRecord(parseInt(appointmentId), data);
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = getService();
    const updated = await service.updateMedicalRecord(parseInt(id), req.body);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
