import { Router, Request, Response } from "express";
import { Like } from "typeorm";
import { getDataSource } from "../data-source";
import { Medicine } from "../entities/Medicine";

const router = Router();
const getRepo = () => {
  const dataSource = getDataSource();
  return dataSource.getRepository(Medicine);
};

router.get("/", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { keyword } = req.query;
    let where: any = { active: true };
    
    if (keyword) {
      where = [
        { name: Like(`%${keyword}%`) },
        { pinyin: Like(`%${keyword}%`) },
        { pinyinAbbr: Like(`%${keyword}%`) },
      ].map((w) => ({ ...w, active: true }));
    }
    
    const medicines = await repo.find({
      where,
      order: { name: "ASC" },
    });
    res.json({ success: true, data: medicines });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { id } = req.params;
    const medicine = await repo.findOne({
      where: { id: parseInt(id) },
    });
    res.json({ success: true, data: medicine });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const medicine = repo.create(req.body);
    const saved = await repo.save(medicine);
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
    await repo.update(parseInt(id), { active: false });
    res.json({ success: true, message: "药品已停用" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
