import { Repository, Between, In } from "typeorm";
import { format, addMinutes, parse, isSameDay } from "date-fns";
import { getDataSource } from "../data-source";
import {
  Appointment,
  AppointmentStatus,
  BookingMode,
} from "../entities/Appointment";
import { DoctorSchedule, ScheduleStatus } from "../entities/DoctorSchedule";
import { Doctor } from "../entities/Doctor";
import { Patient } from "../entities/Patient";
import { Department } from "../entities/Department";
import { Notification, NotificationType } from "../entities/Notification";
import { FeeCalculator } from "../utils/feeCalculator";
import { CreditSystem } from "../utils/creditSystem";

export class AppointmentService {
  private appointmentRepo: Repository<Appointment>;
  private scheduleRepo: Repository<DoctorSchedule>;
  private doctorRepo: Repository<Doctor>;
  private patientRepo: Repository<Patient>;
  private departmentRepo: Repository<Department>;
  private notificationRepo: Repository<Notification>;

  constructor() {
    const dataSource = getDataSource();
    this.appointmentRepo = dataSource.getRepository(Appointment);
    this.scheduleRepo = dataSource.getRepository(DoctorSchedule);
    this.doctorRepo = dataSource.getRepository(Doctor);
    this.patientRepo = dataSource.getRepository(Patient);
    this.departmentRepo = dataSource.getRepository(Department);
    this.notificationRepo = dataSource.getRepository(Notification);
  }

  generateAppointmentNo(): string {
    const now = new Date();
    const timestamp = format(now, "yyyyMMddHHmmss");
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `APT${timestamp}${random}`;
  }

  async getAvailableTimeSlots(
    doctorId: number,
    date: string
  ): Promise<Array<{ time: string; available: boolean }>> {
    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId },
    });
    if (!doctor) throw new Error("医生不存在");

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    const schedules = await this.scheduleRepo.find({
      where: [
        { doctorId, dayOfWeek: dayOfWeek as any, status: ScheduleStatus.ACTIVE },
        { doctorId, specificDate: date, status: ScheduleStatus.ACTIVE },
      ],
    });

    const existingAppointments = await this.appointmentRepo.find({
      where: {
        doctorId,
        appointmentDate: date,
        status: In([
          AppointmentStatus.PENDING,
          AppointmentStatus.COMPLETED,
        ]),
      },
    });

    const bookedTimes = existingAppointments.map((a) => a.appointmentTime);

    const timeSlots: Array<{ time: string; available: boolean }> = [];

    for (const schedule of schedules) {
      let currentTime = parse(schedule.startTime, "HH:mm:ss", new Date());
      const endTime = parse(schedule.endTime, "HH:mm:ss", new Date());

      while (currentTime < endTime) {
        const timeStr = format(currentTime, "HH:mm");
        const isBooked = bookedTimes.some(
          (t) => t.startsWith(timeStr) || timeStr.startsWith(t.slice(0, 5))
        );
        timeSlots.push({
          time: timeStr,
          available: !isBooked,
        });
        currentTime = addMinutes(currentTime, schedule.appointmentDuration);
      }
    }

    return timeSlots.sort((a, b) => a.time.localeCompare(b.time));
  }

  async getDailyAppointmentCount(doctorId: number, date: string): Promise<number> {
    return this.appointmentRepo.count({
      where: {
        doctorId,
        appointmentDate: date,
        status: In([
          AppointmentStatus.PENDING,
          AppointmentStatus.COMPLETED,
        ]),
      },
    });
  }

  async createAppointment(
    patientId: number,
    doctorId: number,
    scheduleId: number,
    appointmentDate: string,
    appointmentTime: string,
    bookingMode: BookingMode = BookingMode.ONLINE
  ): Promise<Appointment> {
    const patient = await this.patientRepo.findOne({
      where: { id: patientId },
    });
    if (!patient) throw new Error("患者不存在");

    if (!CreditSystem.canBook(patient)) {
      throw new Error("您的信用积分不足或违约次数过多，无法预约");
    }

    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId },
      relations: ["department"],
    });
    if (!doctor) throw new Error("医生不存在");

    const schedule = await this.scheduleRepo.findOne({
      where: { id: scheduleId },
    });
    if (!schedule) throw new Error("排班不存在");
    if (schedule.status !== ScheduleStatus.ACTIVE) throw new Error("该排班已停诊");

    const dailyCount = await this.getDailyAppointmentCount(
      doctorId,
      appointmentDate
    );
    if (dailyCount >= doctor.dailyMaxPatients) {
      throw new Error("该医生当日预约已满");
    }

    const existingAppointment = await this.appointmentRepo.findOne({
      where: {
        doctorId,
        appointmentDate,
        appointmentTime: appointmentTime + ":00",
        status: AppointmentStatus.PENDING,
      },
    });
    if (existingAppointment) {
      throw new Error("该时段已被预约");
    }

    const department = await this.departmentRepo.findOne({
      where: { id: doctor.departmentId },
    });
    if (!department) throw new Error("科室不存在");

    const feeInfo = FeeCalculator.calculateRegistrationFee(
      department,
      doctor,
      patient
    );

    const appointmentDateTime = new Date(
      `${appointmentDate} ${appointmentTime}`
    );

    const appointment = this.appointmentRepo.create({
      appointmentNo: this.generateAppointmentNo(),
      patientId,
      doctorId,
      scheduleId,
      appointmentDate,
      appointmentTime: appointmentTime + ":00",
      appointmentDateTime: format(appointmentDateTime, "yyyy-MM-dd HH:mm:ss"),
      queueNumber: dailyCount + 1,
      status: AppointmentStatus.PENDING,
      bookingMode,
      originalFee: feeInfo.originalFee,
      actualFee: feeInfo.actualFee,
      discountApplied: feeInfo.discount,
    });

    const saved = await this.appointmentRepo.save(appointment);

    await this.createNotification(
      patientId,
      NotificationType.APPOINTMENT_REMINDER,
      "预约成功",
      `您已成功预约${doctor.name}医生${appointmentDate} ${appointmentTime}的号源，预约号：${saved.appointmentNo}`
    );

    return saved;
  }

  async cancelAppointment(
    appointmentId: number,
    reason: string
  ): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ["patient"],
    });
    if (!appointment) throw new Error("预约不存在");
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new Error("只能取消待就诊的预约");
    }

    const cancellationTime = new Date();
    const appointmentDateTime = new Date(appointment.appointmentDateTime);

    const creditResult = CreditSystem.processCancellation(
      appointment.patient,
      appointmentDateTime,
      cancellationTime
    );

    appointment.status = AppointmentStatus.CANCELLED_BY_PATIENT;
    appointment.cancellationReason = reason;
    appointment.cancelledAt = format(cancellationTime, "yyyy-MM-dd HH:mm:ss");
    appointment.creditPointsDeducted = creditResult.pointsDeducted;

    const patient = appointment.patient;
    patient.creditScore = patient.creditScore - creditResult.pointsDeducted;
    if (creditResult.isBreach) {
      patient.consecutiveBreaches++;
    } else if (creditResult.pointsDeducted === 0) {
      patient.consecutiveBreaches = 0;
    }
    patient.bookingAllowed = creditResult.bookingStillAllowed;

    await this.patientRepo.save(patient);
    const saved = await this.appointmentRepo.save(appointment);

    if (creditResult.pointsDeducted > 0) {
      await this.createNotification(
        appointment.patientId,
        NotificationType.CREDIT_DEDUCTION,
        "信用积分扣除通知",
        `由于您在${appointment.appointmentDate} ${appointment.appointmentTime}预约取消时间较晚，扣除信用积分${creditResult.pointsDeducted}分，当前积分：${patient.creditScore}`
      );
    }

    return saved;
  }

  private async createNotification(
    patientId: number,
    type: NotificationType,
    title: string,
    content: string,
    relatedAppointmentId?: number
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      patientId,
      type,
      title,
      content,
      relatedAppointmentId,
    });
    return this.notificationRepo.save(notification);
  }

  async getPatientAppointments(
    patientId: number,
    status?: AppointmentStatus
  ): Promise<Appointment[]> {
    const where: any = { patientId };
    if (status) where.status = status;

    return this.appointmentRepo.find({
      where,
      relations: ["doctor", "schedule"],
      order: { appointmentDateTime: "DESC" },
    });
  }

  async getDoctorAppointments(
    doctorId: number,
    date?: string,
    status?: AppointmentStatus
  ): Promise<Appointment[]> {
    const where: any = { doctorId };
    if (date) where.appointmentDate = date;
    if (status) where.status = status;

    return this.appointmentRepo.find({
      where,
      relations: ["patient"],
      order: { appointmentTime: "ASC" },
    });
  }

  async completeAppointment(appointmentId: number): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });
    if (!appointment) throw new Error("预约不存在");

    appointment.status = AppointmentStatus.COMPLETED;
    return this.appointmentRepo.save(appointment);
  }
}
