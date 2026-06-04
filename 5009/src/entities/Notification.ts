import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Patient } from "./Patient";

export enum NotificationType {
  APPOINTMENT_REMINDER = "APPOINTMENT_REMINDER",
  APPOINTMENT_CANCELLED = "APPOINTMENT_CANCELLED",
  DOCTOR_CANCELLED = "DOCTOR_CANCELLED",
  RESCHEDULE_REQUIRED = "RESCHEDULE_REQUIRED",
  CREDIT_DEDUCTION = "CREDIT_DEDUCTION",
  SYSTEM = "SYSTEM",
}

export enum NotificationStatus {
  UNREAD = "UNREAD",
  READ = "READ",
  DISMISSED = "DISMISSED",
}

export const NotificationTypeLabel: Record<NotificationType, string> = {
  [NotificationType.APPOINTMENT_REMINDER]: "预约提醒",
  [NotificationType.APPOINTMENT_CANCELLED]: "预约取消",
  [NotificationType.DOCTOR_CANCELLED]: "医生停诊",
  [NotificationType.RESCHEDULE_REQUIRED]: "需要改期",
  [NotificationType.CREDIT_DEDUCTION]: "积分扣除",
  [NotificationType.SYSTEM]: "系统通知",
};

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Patient)
  @JoinColumn()
  patient: Patient;

  @Column()
  patientId: number;

  @Column({
    type: "simple-enum",
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column("text")
  content: string;

  @Column("int", { nullable: true })
  relatedAppointmentId: number;

  @Column({
    type: "simple-enum",
    enum: NotificationStatus,
    default: NotificationStatus.UNREAD,
  })
  status: NotificationStatus;

  @Column("datetime", { default: () => "CURRENT_TIMESTAMP" })
  createdAt: string;

  @Column("datetime", { nullable: true })
  readAt: string;
}
