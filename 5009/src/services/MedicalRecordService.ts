import { Repository } from "typeorm";
import { format } from "date-fns";
import { getDataSource } from "../data-source";
import { MedicalRecord } from "../entities/MedicalRecord";
import { Appointment, AppointmentStatus } from "../entities/Appointment";
import { Doctor } from "../entities/Doctor";
import { Patient } from "../entities/Patient";

export class MedicalRecordService {
  private recordRepo: Repository<MedicalRecord>;
  private appointmentRepo: Repository<Appointment>;
  private doctorRepo: Repository<Doctor>;
  private patientRepo: Repository<Patient>;

  constructor() {
    const dataSource = getDataSource();
    this.recordRepo = dataSource.getRepository(MedicalRecord);
    this.appointmentRepo = dataSource.getRepository(Appointment);
    this.doctorRepo = dataSource.getRepository(Doctor);
    this.patientRepo = dataSource.getRepository(Patient);
  }

  generateRecordNo(): string {
    const now = new Date();
    const timestamp = format(now, "yyyyMMddHHmmss");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `MR${timestamp}${random}`;
  }

  async createMedicalRecord(
    appointmentId: number,
    data: {
      chiefComplaint?: string;
      presentIllness?: string;
      pastHistory?: string;
      physicalExamination?: string;
      auxiliaryExamination?: string;
      diagnosis?: string;
      treatmentPlan?: string;
      doctorAdvice?: string;
    }
  ): Promise<MedicalRecord> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ["patient", "doctor"],
    });
    if (!appointment) throw new Error("预约不存在");

    const existingRecord = await this.recordRepo.findOne({
      where: { appointmentId },
    });
    if (existingRecord) throw new Error("该预约已有病历记录");

    const record = this.recordRepo.create({
      recordNo: this.generateRecordNo(),
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentId,
      visitDate: appointment.appointmentDate,
      ...data,
    });

    appointment.status = AppointmentStatus.COMPLETED;
    await this.appointmentRepo.save(appointment);

    return this.recordRepo.save(record);
  }

  async updateMedicalRecord(
    recordId: number,
    data: Partial<MedicalRecord>
  ): Promise<MedicalRecord> {
    const record = await this.recordRepo.findOne({
      where: { id: recordId },
    });
    if (!record) throw new Error("病历不存在");

    Object.assign(record, data);
    record.updatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    return this.recordRepo.save(record);
  }

  async getPatientMedicalRecords(
    patientId: number
  ): Promise<MedicalRecord[]> {
    return this.recordRepo.find({
      where: { patientId },
      relations: ["doctor", "appointment", "prescriptions", "prescriptions.items"],
      order: { visitDate: "DESC", createdAt: "DESC" },
    });
  }

  async getMedicalRecord(recordId: number): Promise<MedicalRecord | null> {
    return this.recordRepo.findOne({
      where: { id: recordId },
      relations: [
        "patient",
        "doctor",
        "appointment",
        "prescriptions",
        "prescriptions.items",
      ],
    });
  }

  async getAppointmentMedicalRecord(
    appointmentId: number
  ): Promise<MedicalRecord | null> {
    return this.recordRepo.findOne({
      where: { appointmentId },
      relations: [
        "patient",
        "doctor",
        "appointment",
        "prescriptions",
        "prescriptions.items",
      ],
    });
  }
}
