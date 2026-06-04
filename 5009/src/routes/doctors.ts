import { Router, Request, Response } from "express";
import { Repository } from "typeorm";
import { getDataSource } from "../data-source";
import { Doctor } from "../entities/Doctor";
import { Department } from "../entities/Department";

const router = Router();
const getRepos = () => {
  const dataSource = getDataSource();
  return {
    doctorRepo: dataSource.getRepository(Doctor),
    deptRepo: dataSource.getRepository(Department),
  };
};

router.get("/", async (req: Request, res: Response) => {
  try {
    const { doctorRepo } = getRepos();
    const doctors = await doctorRepo.find({
      relations: ["department", "schedules"],
    });
    res.json({ success: true, data: doctors });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/department/:departmentId", async (req: Request, res: Response) => {
  try {
    const { doctorRepo } = getRepos();
    const { departmentId } = req.params;
    const doctors = await doctorRepo.find({
      where: { departmentId: parseInt(departmentId) },
      relations: ["department", "schedules"],
    });
    res.json({ success: true, data: doctors });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { doctorRepo } = getRepos();
    const { id } = req.params;
    const doctor = await doctorRepo.findOne({
      where: { id: parseInt(id) },
      relations: ["department", "schedules"],
    });
    res.json({ success: true, data: doctor });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { doctorRepo } = getRepos();
    const doctor = doctorRepo.create(req.body);
    const saved = await doctorRepo.save(doctor);
    res.json({ success: true, data: saved });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { doctorRepo } = getRepos();
    const { id } = req.params;
    await doctorRepo.update(parseInt(id), req.body);
    const updated = await doctorRepo.findOne({ where: { id: parseInt(id) } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { doctorRepo } = getRepos();
    const { id } = req.params;
    await doctorRepo.delete(parseInt(id));
    res.json({ success: true, message: "医生已删除" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
