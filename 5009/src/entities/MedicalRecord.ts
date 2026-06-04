import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
} from "typeorm";
import { Patient } from "./Patient";
import { Doctor } from "./Doctor";
import { Appointment } from "./Appointment";
import { Prescription } from "./Prescription";

@Entity()
export class MedicalRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  recordNo: string;

  @ManyToOne(() => Patient, (patient) => patient.medicalRecords)
  @JoinColumn()
  patient: Patient;

  @Column()
  patientId: number;

  @ManyToOne(() => Doctor)
  @JoinColumn()
  doctor: Doctor;

  @Column()
  doctorId: number;

  @OneToOne(() => Appointment, (appointment) => appointment.medicalRecord)
  @JoinColumn()
  appointment: Appointment;

  @Column()
  appointmentId: number;

  @Column("date")
  visitDate: string;

  @Column("text", { nullable: true })
  chiefComplaint: string;

  @Column("text", { nullable: true })
  presentIllness: string;

  @Column("text", { nullable: true })
  pastHistory: string;

  @Column("text", { nullable: true })
  physicalExamination: string;

  @Column("text", { nullable: true })
  auxiliaryExamination: string;

  @Column("text", { nullable: true })
  diagnosis: string;

  @Column("text", { nullable: true })
  treatmentPlan: string;

  @Column("text", { nullable: true })
  doctorAdvice: string;

  @Column("datetime", { default: () => "CURRENT_TIMESTAMP" })
  createdAt: string;

  @Column("datetime", { nullable: true })
  updatedAt: string;

  @OneToMany(() => Prescription, (prescription) => prescription.medicalRecord)
  prescriptions: Prescription[];
}
