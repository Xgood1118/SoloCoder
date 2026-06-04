import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Doctor } from "./Doctor";

@Entity()
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column("text", { nullable: true })
  description: string;

  @Column("decimal", { precision: 10, scale: 2 })
  baseRegistrationFee: number;

  @OneToMany(() => Doctor, (doctor) => doctor.department)
  doctors: Doctor[];
}
