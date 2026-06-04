import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Department } from "./Department";
import { DoctorSchedule } from "./DoctorSchedule";
import { Appointment } from "./Appointment";

export enum DoctorTitle {
  INTERN = "INTERN",
  RESIDENT = "RESIDENT",
  ATTENDING = "ATTENDING",
  CHIEF = "CHIEF",
}

export const DoctorTitleLabel: Record<DoctorTitle, string> = {
  [DoctorTitle.INTERN]: "住院医师",
  [DoctorTitle.RESIDENT]: "主治医师",
  [DoctorTitle.ATTENDING]: "副主任医师",
  [DoctorTitle.CHIEF]: "主任医师",
};

@Entity()
export class Doctor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  employeeId: string;

  @Column({
    type: "simple-enum",
    enum: DoctorTitle,
    default: DoctorTitle.RESIDENT,
  })
  title: DoctorTitle;

  @Column("text", { nullable: true })
  specialty: string;

  @Column("int", { default: 30 })
  dailyMaxPatients: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  titleFeeMultiplier: number;

  @ManyToOne(() => Department, (department) => department.doctors)
  @JoinColumn()
  department: Department;

  @Column()
  departmentId: number;

  @OneToMany(() => DoctorSchedule, (schedule) => schedule.doctor)
  schedules: DoctorSchedule[];

  @OneToMany(() => Appointment, (appointment) => appointment.doctor)
  appointments: Appointment[];
}
