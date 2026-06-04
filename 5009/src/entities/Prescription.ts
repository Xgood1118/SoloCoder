import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { MedicalRecord } from "./MedicalRecord";
import { Doctor } from "./Doctor";
import { Patient } from "./Patient";
import { PrescriptionItem } from "./PrescriptionItem";

export enum PrescriptionStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  DISPENSED = "DISPENSED",
  CANCELLED = "CANCELLED",
}

export const PrescriptionStatusLabel: Record<PrescriptionStatus, string> = {
  [PrescriptionStatus.DRAFT]: "草稿",
  [PrescriptionStatus.ISSUED]: "已开立",
  [PrescriptionStatus.DISPENSED]: "已配药",
  [PrescriptionStatus.CANCELLED]: "已作废",
};

@Entity()
export class Prescription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  prescriptionNo: string;

  @ManyToOne(() => MedicalRecord, (record) => record.prescriptions)
  @JoinColumn()
  medicalRecord: MedicalRecord;

  @Column()
  medicalRecordId: number;

  @ManyToOne(() => Patient)
  @JoinColumn()
  patient: Patient;

  @Column()
  patientId: number;

  @ManyToOne(() => Doctor)
  @JoinColumn()
  doctor: Doctor;

  @Column()
  doctorId: number;

  @Column({
    type: "simple-enum",
    enum: PrescriptionStatus,
    default: PrescriptionStatus.DRAFT,
  })
  status: PrescriptionStatus;

  @Column("text", { nullable: true })
  remarks: string;

  @Column("datetime", { default: () => "CURRENT_TIMESTAMP" })
  createdAt: string;

  @Column("datetime", { nullable: true })
  issuedAt: string;

  @OneToMany(() => PrescriptionItem, (item) => item.prescription, {
    cascade: true,
  })
  items: PrescriptionItem[];
}
