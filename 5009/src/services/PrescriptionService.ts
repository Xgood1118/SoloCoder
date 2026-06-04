import { Repository, Like } from "typeorm";
import { format } from "date-fns";
import { getDataSource } from "../data-source";
import { Prescription, PrescriptionStatus } from "../entities/Prescription";
import { PrescriptionItem } from "../entities/PrescriptionItem";
import { MedicalRecord } from "../entities/MedicalRecord";
import { Medicine } from "../entities/Medicine";

export interface PrescriptionItemData {
  medicineId: number;
  quantity: number;
  dosage?: string;
  frequency?: string;
  usage?: string;
  remarks?: string;
}

export class PrescriptionService {
  private prescriptionRepo: Repository<Prescription>;
  private itemRepo: Repository<PrescriptionItem>;
  private recordRepo: Repository<MedicalRecord>;
  private medicineRepo: Repository<Medicine>;

  constructor() {
    const dataSource = getDataSource();
    this.prescriptionRepo = dataSource.getRepository(Prescription);
    this.itemRepo = dataSource.getRepository(PrescriptionItem);
    this.recordRepo = dataSource.getRepository(MedicalRecord);
    this.medicineRepo = dataSource.getRepository(Medicine);
  }

  generatePrescriptionNo(): string {
    const now = new Date();
    const timestamp = format(now, "yyyyMMddHHmmss");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `RX${timestamp}${random}`;
  }

  async searchMedicine(keyword: string): Promise<Medicine[]> {
    return this.medicineRepo.find({
      where: [
        { name: Like(`%${keyword}%`), active: true },
        { pinyin: Like(`%${keyword}%`), active: true },
        { pinyinAbbr: Like(`%${keyword}%`), active: true },
        { genericName: Like(`%${keyword}%`), active: true },
      ],
      take: 20,
    });
  }

  async createPrescription(
    medicalRecordId: number,
    items: PrescriptionItemData[],
    remarks?: string
  ): Promise<Prescription> {
    const record = await this.recordRepo.findOne({
      where: { id: medicalRecordId },
      relations: ["appointment", "appointment.doctor", "appointment.patient"],
    });
    if (!record) throw new Error("病历记录不存在");

    const prescription = this.prescriptionRepo.create({
      prescriptionNo: this.generatePrescriptionNo(),
      medicalRecordId,
      patientId: record.appointment.patientId,
      doctorId: record.appointment.doctorId,
      status: PrescriptionStatus.DRAFT,
      remarks,
      items: [],
    });

    const savedPrescription = await this.prescriptionRepo.save(prescription);

    const prescriptionItems: PrescriptionItem[] = [];
    for (const itemData of items) {
      const medicine = await this.medicineRepo.findOne({
        where: { id: itemData.medicineId },
      });
      if (!medicine) throw new Error(`药品ID ${itemData.medicineId} 不存在`);

      const item = this.itemRepo.create({
        prescriptionId: savedPrescription.id,
        medicineId: medicine.id,
        medicineName: medicine.name,
        specification: medicine.specification || "",
        unitPrice: medicine.unitPrice,
        quantity: itemData.quantity,
        totalPrice: medicine.unitPrice * itemData.quantity,
        dosage: itemData.dosage,
        frequency: itemData.frequency,
        usage: itemData.usage,
        remarks: itemData.remarks,
      });
      prescriptionItems.push(item);
    }

    await this.itemRepo.save(prescriptionItems);
    savedPrescription.items = prescriptionItems;

    return savedPrescription;
  }

  async issuePrescription(prescriptionId: number): Promise<Prescription> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId },
      relations: ["items"],
    });
    if (!prescription) throw new Error("处方不存在");
    if (prescription.status !== PrescriptionStatus.DRAFT) {
      throw new Error("只能开立草稿状态的处方");
    }

    prescription.status = PrescriptionStatus.ISSUED;
    prescription.issuedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    return this.prescriptionRepo.save(prescription);
  }

  async dispensePrescription(prescriptionId: number): Promise<Prescription> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId },
      relations: ["items", "items.medicine"],
    });
    if (!prescription) throw new Error("处方不存在");
    if (prescription.status !== PrescriptionStatus.ISSUED) {
      throw new Error("只能配药已开立的处方");
    }

    for (const item of prescription.items) {
      const medicine = item.medicine;
      if (medicine.stock < item.quantity) {
        throw new Error(`药品 ${medicine.name} 库存不足`);
      }
      medicine.stock -= item.quantity;
      await this.medicineRepo.save(medicine);
    }

    prescription.status = PrescriptionStatus.DISPENSED;
    return this.prescriptionRepo.save(prescription);
  }

  async cancelPrescription(prescriptionId: number): Promise<Prescription> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId },
    });
    if (!prescription) throw new Error("处方不存在");
    if (prescription.status === PrescriptionStatus.DISPENSED) {
      throw new Error("已配药的处方无法作废");
    }

    prescription.status = PrescriptionStatus.CANCELLED;
    return this.prescriptionRepo.save(prescription);
  }

  async getPrescription(prescriptionId: number): Promise<Prescription | null> {
    return this.prescriptionRepo.findOne({
      where: { id: prescriptionId },
      relations: ["items", "items.medicine", "doctor", "patient"],
    });
  }

  async getMedicalRecordPrescriptions(
    medicalRecordId: number
  ): Promise<Prescription[]> {
    return this.prescriptionRepo.find({
      where: { medicalRecordId },
      relations: ["items"],
      order: { createdAt: "DESC" },
    });
  }

  async getPatientPrescriptions(patientId: number): Promise<Prescription[]> {
    return this.prescriptionRepo.find({
      where: { patientId },
      relations: ["items", "medicalRecord", "doctor"],
      order: { createdAt: "DESC" },
    });
  }
}
