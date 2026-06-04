import { Router, Request, Response } from "express";
import { format } from "date-fns";
import { getDataSource } from "../data-source";
import { Notification, NotificationStatus } from "../entities/Notification";

const router = Router();
const getRepo = () => {
  const dataSource = getDataSource();
  return dataSource.getRepository(Notification);
};

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { patientId } = req.params;
    const { status } = req.query;
    
    const where: any = { patientId: parseInt(patientId) };
    if (status) where.status = status;
    
    const notifications = await repo.find({
      where,
      order: { createdAt: "DESC" },
    });
    res.json({ success: true, data: notifications });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/read", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { id } = req.params;
    await repo.update(parseInt(id), {
      status: NotificationStatus.READ,
      readAt: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
    });
    const updated = await repo.findOne({ where: { id: parseInt(id) } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/dismiss", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { id } = req.params;
    await repo.update(parseInt(id), {
      status: NotificationStatus.DISMISSED });
    res.json({ success: true, message: "通知已删除" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/patient/:patientId/read-all", async (req: Request, res: Response) => {
  try {
    const repo = getRepo();
    const { patientId } = req.params;
    await repo.update(
      { patientId: parseInt(patientId), status: NotificationStatus.UNREAD },
      { status: NotificationStatus.READ, readAt: format(new Date(), "yyyy-MM-dd HH:mm:ss") }
    );
    res.json({ success: true, message: "全部已读" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
