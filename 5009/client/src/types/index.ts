export interface Department {
  id: number;
  name: string;
  description?: string;
  baseRegistrationFee: number;
  doctors?: Doctor[];
}

export interface Doctor {
  id: number;
  name: string;
  employeeId: string;
  title: string;
  specialty?: string;
  departmentId: number;
  department?: Department;
  dailyMaxPatients: number;
}

export interface Patient {
  id: number;
  name: string;
  idCard: string;
  phone: string;
  birthday?: string;
  gender: string;
  memberLevel: string;
  creditScore: number;
  consecutiveBreaches: number;
  bookingAllowed: boolean;
}

export interface DoctorSchedule {
  id: number;
  doctorId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  appointmentDuration: number;
  status: string;
  specificDate?: string;
}

export interface Appointment {
  id: number;
  appointmentNo: string;
  patientId: number;
  patient?: Patient;
  doctorId: number;
  doctor?: Doctor;
  scheduleId: number;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDateTime: string;
  queueNumber: number;
  status: string;
  bookingMode: string;
  originalFee: number;
  actualFee: number;
  discountApplied: number;
}

export interface MedicalRecord {
  id: number;
  recordNo: string;
  patientId: number;
  doctorId: number;
  appointmentId: number;
  visitDate: string;
  chiefComplaint?: string;
  presentIllness?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  doctorAdvice?: string;
  prescriptions?: Prescription[];
}

export interface Prescription {
  id: number;
  prescriptionNo: string;
  medicalRecordId: number;
  patientId: number;
  doctorId: number;
  status: string;
  items?: PrescriptionItem[];
}

export interface PrescriptionItem {
  id: number;
  medicineId: number;
  medicineName: string;
  specification: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  dosage?: string;
  frequency?: string;
  usage?: string;
}

export interface Medicine {
  id: number;
  code: string;
  name: string;
  specification?: string;
  unitPrice: number;
  stock: number;
}

export interface Notification {
  id: number;
  patientId: number;
  type: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
}
