import { Router, Request, Response } from "express";
import { PrescriptionService } from "../services/PrescriptionService";

const router = Router();
const getService = () => new PrescriptionService();

router.get("/medicines/search", async (req: Request, res: Response) => {
  try {
    const { keyword } = req.query;
    const service = getService();
    const medicines = await service.searchMedicine(keyword as string);
    res.json({ success: true, data: medicines });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/medical-record/:medicalRecordId", async (req: Request, res: Response) => {
  try {
    const { medicalRecordId } = req.params;
    const service = getService();
    const prescriptions = await service.getMedicalRecordPrescriptions(parseInt(medicalRecordId));
    res.json({ success: true, data: prescriptions });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const service = getService();
    const prescriptions = await service.getPatientPrescriptions(parseInt(patientId));
    res.json({ success: true, data: prescriptions });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = getService();
    const prescription = await service.getPrescription(parseInt(id));
    res.json({ success: true, data: prescription });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { medicalRecordId, items, remarks } = req.body;
    const service = getService();
    const prescription = await service.createPrescription(
      parseInt(medicalRecordId),
      items,
      remarks
    );
    res.json({ success: true, data: prescription });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/issue", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = getService();
    const prescription = await service.issuePrescription(parseInt(id));
    res.json({ success: true, data: prescription });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/dispense", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = getService();
    const prescription = await service.dispensePrescription(parseInt(id));
    res.json({ success: true, data: prescription });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = getService();
    const prescription = await service.cancelPrescription(parseInt(id));
    res.json({ success: true, data: prescription });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
