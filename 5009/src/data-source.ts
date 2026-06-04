import "reflect-metadata";
import { DataSource } from "typeorm";
import initSqlJs from "sql.js";
import { Department } from "./entities/Department";
import { Doctor } from "./entities/Doctor";
import { Patient } from "./entities/Patient";
import { DoctorSchedule } from "./entities/DoctorSchedule";
import { Appointment } from "./entities/Appointment";
import { MedicalRecord } from "./entities/MedicalRecord";
import { Prescription } from "./entities/Prescription";
import { PrescriptionItem } from "./entities/PrescriptionItem";
import { Medicine } from "./entities/Medicine";
import { Notification } from "./entities/Notification";
import * as fs from "fs";
import * as path from "path";

let dataSource: DataSource;
let SqlJsDriver: any;

const DB_FILE_PATH = path.join(__dirname, "../hospital.db");

export async function initializeDataSource(): Promise<DataSource> {
  if (dataSource && dataSource.isInitialized) {
    return dataSource;
  }

  if (!SqlJsDriver) {
    SqlJsDriver = await initSqlJs({
      locateFile: (file: string) => `node_modules/sql.js/dist/${file}`,
    });
  }

  let databaseBuffer: Uint8Array | undefined;
  if (fs.existsSync(DB_FILE_PATH)) {
    databaseBuffer = new Uint8Array(fs.readFileSync(DB_FILE_PATH));
  }

  dataSource = new DataSource({
    type: "sqljs",
    driver: SqlJsDriver,
    database: databaseBuffer,
    location: DB_FILE_PATH,
    autoSave: true,
    synchronize: true,
    logging: false,
    entities: [
      Department,
      Doctor,
      Patient,
      DoctorSchedule,
      Appointment,
      MedicalRecord,
      Prescription,
      PrescriptionItem,
      Medicine,
      Notification,
    ],
    migrations: [],
    subscribers: [],
  });

  await dataSource.initialize();
  return dataSource;
}

export function getDataSource(): DataSource {
  if (!dataSource) {
    throw new Error("DataSource not initialized. Call initializeDataSource() first.");
  }
  return dataSource;
}
