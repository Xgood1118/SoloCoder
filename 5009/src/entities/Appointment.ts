import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from "typeorm";
import { Doctor } from "./Doctor";
import { Patient } from "./Patient";
import { DoctorSchedule } from "./DoctorSchedule";
import { MedicalRecord } from "./MedicalRecord";

export enum AppointmentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELLED_BY_PATIENT = "CANCELLED_BY_PATIENT",
  CANCELLED_BY_DOCTOR = "CANCELLED_BY_DOCTOR",
  NO_SHOW = "NO_SHOW",
  RESCHEDULED = "RESCHEDULED",
}

export enum BookingMode {
  ONLINE = "ONLINE",
  ONSITE = "ONSITE",
}

export const AppointmentStatusLabel: Record<AppointmentStatus, string> = {
  [AppointmentStatus.PENDING]: "待就诊",
  [AppointmentStatus.COMPLETED]: "已完成",
  [AppointmentStatus.CANCELLED_BY_PATIENT]: "患者取消",
  [AppointmentStatus.CANCELLED_BY_DOCTOR]: "医生停诊",
  [AppointmentStatus.NO_SHOW]: "爽约",
  [AppointmentStatus.RESCHEDULED]: "已改期",
};

export const BookingModeLabel: Record<BookingMode, string> = {
  [BookingMode.ONLINE]: "线上挂号",
  [BookingMode.ONSITE]: "现场挂号",
};

@Entity()
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  appointmentNo: string;

  @ManyToOne(() => Doctor, (doctor) => doctor.appointments)
  @JoinColumn()
  doctor: Doctor;

  @Column()
  doctorId: number;

  @ManyToOne(() => Patient, (patient) => patient.appointments)
  @JoinColumn()
  patient: Patient;

  @Column()
  patientId: number;

  @ManyToOne(() => DoctorSchedule, (schedule) => schedule.appointments)
  @JoinColumn()
  schedule: DoctorSchedule;

  @Column()
  scheduleId: number;

  @Column("date")
  appointmentDate: string;

  @Column("time")
  appointmentTime: string;

  @Column("datetime")
  appointmentDateTime: string;

  @Column("int", { nullable: true })
  queueNumber: number;

  @Column({
    type: "simple-enum",
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @Column({
    type: "simple-enum",
    enum: BookingMode,
    default: BookingMode.ONLINE,
  })
  bookingMode: BookingMode;

  @Column("decimal", { precision: 10, scale: 2 })
  originalFee: number;

  @Column("decimal", { precision: 10, scale: 2 })
  actualFee: number;

  @Column("decimal", { precision: 5, scale: 2, default: 0 })
  discountApplied: number;

  @Column("text", { nullable: true })
  cancellationReason: string;

  @Column("datetime", { nullable: true })
  cancelledAt: string;

  @Column("int", { default: 0 })
  creditPointsDeducted: number;

  @Column("datetime", { default: () => "CURRENT_TIMESTAMP" })
  createdAt: string;

  @OneToOne(() => MedicalRecord, (record) => record.appointment)
  medicalRecord: MedicalRecord;
}
