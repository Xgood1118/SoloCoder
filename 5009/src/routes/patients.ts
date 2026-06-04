import { Router, Request, Response } from "express";
import { getDataSource } from "../data-source";
import { Patient } from "../entities/Patient";

const router = Router();
const getRepo = () => {
  const dataSource = getDataSource();
  return dataSource.getRepository(Patient);
};

router.get("/", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const patients = await repo.find({
      order: { createdAt: "DESC" },
    });
    res.json({ success: true, data: patients });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { id } = req.params;
    const patient = await repo.findOne({
      where: { id: parseInt(id) },
      relations: ["appointments", "medicalRecords"],
    });
    res.json({ success: true, data: patient });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const patient = repo.create(req.body);
    const saved = await repo.save(patient);
    res.json({ success: true, data: saved });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { id } = req.params;
    await repo.update(parseInt(id), req.body);
    const updated = await repo.findOne({ where: { id: parseInt(id) } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
