import { Router, Request, Response } from "express";
import { getDataSource } from "../data-source";
import { Department } from "../entities/Department";

const router = Router();
const getRepo = () => {
  const dataSource = getDataSource();
  return dataSource.getRepository(Department);
};

router.get("/", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const departments = await repo.find({
      relations: ["doctors"],
    });
    res.json({ success: true, data: departments });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { id } = req.params;
    const department = await repo.findOne({
      where: { id: parseInt(id) },
      relations: ["doctors", "doctors.schedules"],
    });
    res.json({ success: true, data: department });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const department = repo.create(req.body);
    const saved = await repo.save(department);
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

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { id } = req.params;
    await repo.delete(parseInt(id));
    res.json({ success: true, message: "科室已删除" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
