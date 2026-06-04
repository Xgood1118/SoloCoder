import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Prescription } from "./Prescription";
import { Medicine } from "./Medicine";

@Entity()
export class PrescriptionItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Prescription, (prescription) => prescription.items)
  @JoinColumn()
  prescription: Prescription;

  @Column()
  prescriptionId: number;

  @ManyToOne(() => Medicine)
  @JoinColumn()
  medicine: Medicine;

  @Column()
  medicineId: number;

  @Column()
  medicineName: string;

  @Column()
  specification: string;

  @Column("decimal", { precision: 10, scale: 2 })
  unitPrice: number;

  @Column("int")
  quantity: number;

  @Column("decimal", { precision: 10, scale: 2 })
  totalPrice: number;

  @Column("text", { nullable: true })
  dosage: string;

  @Column("text", { nullable: true })
  frequency: string;

  @Column("text", { nullable: true })
  usage: string;

  @Column("text", { nullable: true })
  remarks: string;
}
