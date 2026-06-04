import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Doctor } from "./Doctor";
import { Appointment } from "./Appointment";

export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

export enum ScheduleStatus {
  ACTIVE = "ACTIVE",
  CANCELLED = "CANCELLED",
  TEMPORARY = "TEMPORARY",
}

export const ScheduleStatusLabel: Record<ScheduleStatus, string> = {
  [ScheduleStatus.ACTIVE]: "正常",
  [ScheduleStatus.CANCELLED]: "停诊",
  [ScheduleStatus.TEMPORARY]: "临时",
};

@Entity()
export class DoctorSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Doctor, (doctor) => doctor.schedules)
  @JoinColumn()
  doctor: Doctor;

  @Column()
  doctorId: number;

  @Column({
    type: "simple-enum",
    enum: DayOfWeek,
  })
  dayOfWeek: DayOfWeek;

  @Column("time")
  startTime: string;

  @Column("time")
  endTime: string;

  @Column("int", { default: 30 })
  appointmentDuration: number;

  @Column("int", { default: 0 })
  maxAppointments: number;

  @Column({
    type: "simple-enum",
    enum: ScheduleStatus,
    default: ScheduleStatus.ACTIVE,
  })
  status: ScheduleStatus;

  @Column("date", { nullable: true })
  specificDate: string;

  @Column("text", { nullable: true })
  cancellationReason: string;

  @Column("datetime", { nullable: true })
  cancelledAt: string;

  @Column("datetime", { default: () => "CURRENT_TIMESTAMP" })
  createdAt: string;

  @OneToMany(() => Appointment, (appointment) => appointment.schedule)
  appointments: Appointment[];
}
