import "reflect-metadata";
import { initializeDataSource } from "./data-source";
import { Department } from "./entities/Department";
import { Doctor, DoctorTitle } from "./entities/Doctor";
import { Patient, PatientMemberLevel } from "./entities/Patient";
import { Medicine, MedicineType } from "./entities/Medicine";
import { DayOfWeek } from "./entities/DoctorSchedule";
import { ScheduleService } from "./services/ScheduleService";

async function seed() {
  const dataSource = await initializeDataSource();
  console.log("开始初始化数据...");

  const deptRepo = dataSource.getRepository(Department);
  const doctorRepo = dataSource.getRepository(Doctor);
  const patientRepo = dataSource.getRepository(Patient);
  const medicineRepo = dataSource.getRepository(Medicine);
  const scheduleService = new ScheduleService();

  const departments = [
    { name: "内科", description: "内科诊疗中心", baseRegistrationFee: 20 },
    { name: "外科", description: "外科诊疗中心", baseRegistrationFee: 25 },
    { name: "儿科", description: "儿科诊疗中心", baseRegistrationFee: 15 },
    { name: "妇产科", description: "妇产科诊疗中心", baseRegistrationFee: 30 },
    { name: "眼科", description: "眼科诊疗中心", baseRegistrationFee: 22 },
    { name: "口腔科", description: "口腔科诊疗中心", baseRegistrationFee: 28 },
  ];

  const savedDepts = await deptRepo.save(departments);
  console.log("科室数据初始化完成");

  const doctorsData = [
    { name: "张医生", employeeId: "D001", title: DoctorTitle.CHIEF, specialty: "心血管内科", departmentId: savedDepts[0].id, dailyMaxPatients: 30 },
    { name: "李医生", employeeId: "D002", title: DoctorTitle.ATTENDING, specialty: "消化内科", departmentId: savedDepts[0].id, dailyMaxPatients: 25 },
    { name: "王医生", employeeId: "D003", title: DoctorTitle.RESIDENT, specialty: "普外科", departmentId: savedDepts[1].id, dailyMaxPatients: 20 },
    { name: "赵医生", employeeId: "D004", title: DoctorTitle.CHIEF, specialty: "骨外科", departmentId: savedDepts[1].id, dailyMaxPatients: 30 },
    { name: "刘医生", employeeId: "D005", title: DoctorTitle.ATTENDING, specialty: "小儿呼吸", departmentId: savedDepts[2].id, dailyMaxPatients: 35 },
    { name: "陈医生", employeeId: "D006", title: DoctorTitle.RESIDENT, specialty: "妇科", departmentId: savedDepts[3].id, dailyMaxPatients: 25 },
  ];

  const savedDoctors = await doctorRepo.save(doctorsData);
  console.log("医生数据初始化完成");

  for (const doctor of savedDoctors) {
    const scheduleDays = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY];
    for (const day of scheduleDays.slice(0, 3)) {
      await scheduleService.createSchedule(
        doctor.id,
        day,
        "08:00:00",
        "12:00:00",
        30
      );
    }
    for (const day of scheduleDays.slice(2, 5)) {
      await scheduleService.createSchedule(
        doctor.id,
        day,
        "14:00:00",
        "17:30:00",
        30
      );
    }
  }
  console.log("排班数据初始化完成");

  const patientsData = [
    { name: "患者甲", idCard: "110101199001010001", phone: "13800138001", gender: "男", memberLevel: PatientMemberLevel.NORMAL, creditScore: 100 },
    { name: "患者乙", idCard: "110101199002020002", phone: "13800138002", gender: "女", memberLevel: PatientMemberLevel.SILVER, creditScore: 95 },
    { name: "患者丙", idCard: "110101199003030003", phone: "13800138003", gender: "男", memberLevel: PatientMemberLevel.GOLD, creditScore: 100 },
    { name: "患者丁", idCard: "110101199004040004", phone: "13800138004", gender: "女", memberLevel: PatientMemberLevel.PLATINUM, creditScore: 98 },
  ];

  await patientRepo.save(patientsData);
  console.log("患者数据初始化完成");

  const medicinesData = [
    { code: "M001", name: "阿莫西林胶囊", genericName: "Amoxicillin", pinyin: "amoxilinjiaonang", pinyinAbbr: "amx", type: MedicineType.WESTERN, specification: "0.5g*24粒", unitPrice: 25.5, unit: "盒", stock: 100 },
    { code: "M002", name: "布洛芬缓释胶囊", genericName: "Ibuprofen", pinyin: "buluofenhuanshijiaonang", pinyinAbbr: "blf", type: MedicineType.WESTERN, specification: "0.3g*20粒", unitPrice: 18.0, unit: "盒", stock: 150 },
    { code: "M003", name: "感冒灵颗粒", genericName: "Ganmaoling", pinyin: "ganmaolingkeli", pinyinAbbr: "gml", type: MedicineType.PATENT, specification: "10g*9袋", unitPrice: 15.0, unit: "盒", stock: 200 },
    { code: "M004", name: "维生素C片", genericName: "Vitamin C", pinyin: "weishengsuCpian", pinyinAbbr: "wssc", type: MedicineType.WESTERN, specification: "100mg*100片", unitPrice: 8.5, unit: "瓶", stock: 300 },
    { code: "M005", name: "黄连素片", genericName: "Berberine", pinyin: "huangliansupian", pinyinAbbr: "hls", type: MedicineType.PATENT, specification: "0.1g*40片", unitPrice: 12.0, unit: "瓶", stock: 120 },
    { code: "M006", name: "头孢克肟分散片", genericName: "Cefixime", pinyin: "toubaokewofensanpian", pinyinAbbr: "tbkw", type: MedicineType.WESTERN, specification: "0.1g*6片", unitPrice: 35.0, unit: "盒", stock: 80 },
  ];

  await medicineRepo.save(medicinesData);
  console.log("药品数据初始化完成");

  console.log("所有数据初始化完成!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("数据初始化失败:", error);
  process.exit(1);
});
