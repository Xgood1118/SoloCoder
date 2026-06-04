import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

export enum MedicineType {
  WESTERN = "WESTERN",
  CHINESE = "CHINESE",
  PATENT = "PATENT",
}

export const MedicineTypeLabel: Record<MedicineType, string> = {
  [MedicineType.WESTERN]: "西药",
  [MedicineType.CHINESE]: "中药",
  [MedicineType.PATENT]: "中成药",
};

@Entity()
export class Medicine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column("text", { nullable: true })
  genericName: string;

  @Column("text", { nullable: true })
  englishName: string;

  @Column("text", { nullable: true })
  pinyin: string;

  @Column("text", { nullable: true })
  pinyinAbbr: string;

  @Column({
    type: "simple-enum",
    enum: MedicineType,
    default: MedicineType.WESTERN,
  })
  type: MedicineType;

  @Column("text", { nullable: true })
  specification: string;

  @Column("text", { nullable: true })
  dosageForm: string;

  @Column("text", { nullable: true })
  manufacturer: string;

  @Column("decimal", { precision: 10, scale: 2 })
  unitPrice: number;

  @Column("text", { nullable: true })
  unit: string;

  @Column("int", { default: 0 })
  stock: number;

  @Column("text", { nullable: true })
  usage: string;

  @Column("text", { nullable: true })
  contraindications: string;

  @Column("text", { nullable: true })
  adverseReactions: string;

  @Column("boolean", { default: true })
  active: boolean;

  @Column("datetime", { default: () => "CURRENT_TIMESTAMP" })
  createdAt: string;
}
