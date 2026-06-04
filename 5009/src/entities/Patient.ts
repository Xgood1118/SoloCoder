import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Appointment } from "./Appointment";
import { MedicalRecord } from "./MedicalRecord";

export enum PatientMemberLevel {
  NORMAL = "NORMAL",
  SILVER = "SILVER",
  GOLD = "GOLD",
  PLATINUM = "PLATINUM",
}

export const PatientMemberLevelLabel: Record<PatientMemberLevel, string> = {
  [PatientMemberLevel.NORMAL]: "普通",
  [PatientMemberLevel.SILVER]: "银卡",
  [PatientMemberLevel.GOLD]: "金卡",
  [PatientMemberLevel.PLATINUM]: "白金卡",
};

@Entity()
export class Patient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  idCard: string;

  @Column({ unique: true })
  phone: string;

  @Column("date", { nullable: true })
  birthday: string;

  @Column({ default: "男" })
  gender: string;

  @Column("text", { nullable: true })
  address: string;

  @Column({
    type: "simple-enum",
    enum: PatientMemberLevel,
    default: PatientMemberLevel.NORMAL,
  })
  memberLevel: PatientMemberLevel;

  @Column("decimal", { precision: 5, scale: 2, default: 0 })
  memberDiscount: number;

  @Column("int", { default: 100 })
  creditScore: number;

  @Column("int", { default: 0 })
  consecutiveBreaches: number;

  @Column("boolean", { default: true })
  bookingAllowed: boolean;

  @Column("datetime", { default: () => "CURRENT_TIMESTAMP" })
  createdAt: string;

  @OneToMany(() => Appointment, (appointment) => appointment.patient)
  appointments: Appointment[];

  @OneToMany(() => MedicalRecord, (record) => record.patient)
  medicalRecords: MedicalRecord[];
}
