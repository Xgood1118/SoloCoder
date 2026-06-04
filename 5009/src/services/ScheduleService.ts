import { Repository, In, Between } from "typeorm";
import { format, addHours, differenceInHours } from "date-fns";
import { getDataSource } from "../data-source";
import {
  DoctorSchedule,
  ScheduleStatus,
  DayOfWeek,
} from "../entities/DoctorSchedule";
import {
  Appointment,
  AppointmentStatus,
} from "../entities/Appointment";
import { Doctor } from "../entities/Doctor";
import { Notification, NotificationType } from "../entities/Notification";

export class ScheduleService {
  private scheduleRepo: Repository<DoctorSchedule>;
  private appointmentRepo: Repository<Appointment>;
  private doctorRepo: Repository<Doctor>;
  private notificationRepo: Repository<Notification>;

  constructor() {
    const dataSource = getDataSource();
    this.scheduleRepo = dataSource.getRepository(DoctorSchedule);
    this.appointmentRepo = dataSource.getRepository(Appointment);
    this.doctorRepo = dataSource.getRepository(Doctor);
    this.notificationRepo = dataSource.getRepository(Notification);
  }

  async createSchedule(
    doctorId: number,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    appointmentDuration: number = 30,
    specificDate?: string
  ): Promise<DoctorSchedule> {
    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId },
    });
    if (!doctor) throw new Error("医生不存在");

    const schedule = this.scheduleRepo.create({
      doctorId,
      dayOfWeek,
      startTime,
      endTime,
      appointmentDuration,
      maxAppointments: doctor.dailyMaxPatients,
      status: ScheduleStatus.ACTIVE,
      specificDate,
    });

    return this.scheduleRepo.save(schedule);
  }

  async getDoctorSchedules(doctorId: number): Promise<DoctorSchedule[]> {
    return this.scheduleRepo.find({
      where: { doctorId },
      order: { dayOfWeek: "ASC", startTime: "ASC" },
    });
  }

  async updateSchedule(
    scheduleId: number,
    updates: Partial<DoctorSchedule>
  ): Promise<DoctorSchedule> {
    const schedule = await this.scheduleRepo.findOne({
      where: { id: scheduleId },
    });
    if (!schedule) throw new Error("排班不存在");

    Object.assign(schedule, updates);
    return this.scheduleRepo.save(schedule);
  }

  async deleteSchedule(scheduleId: number): Promise<void> {
    await this.scheduleRepo.delete(scheduleId);
  }

  async cancelSchedule(
    scheduleId: number,
    reason: string,
    specificDate?: string
  ): Promise<{ cancelledAppointments: Appointment[]; notifications: Notification[] }> {
    const schedule = await this.scheduleRepo.findOne({
      where: { id: scheduleId },
      relations: ["doctor"],
    });
    if (!schedule) throw new Error("排班不存在");

    const now = new Date();
    const cancelTime = new Date();
    const twentyFourHoursLater = addHours(cancelTime, 24);

    const whereClause: any = {
      scheduleId,
      status: AppointmentStatus.PENDING,
    };

    if (specificDate) {
      whereClause.appointmentDate = specificDate;
    }

    const appointmentsToCancel = await this.appointmentRepo.find({
      where: whereClause,
      relations: ["patient"],
    });

    const validCancellations: Appointment[] = [];
    const notifications: Notification[] = [];

    for (const appointment of appointmentsToCancel) {
      const appointmentTime = new Date(appointment.appointmentDateTime);

      if (differenceInHours(appointmentTime, cancelTime) < 24) {
        console.warn(
          `预约 ${appointment.appointmentNo} 不足24小时，跳过自动取消`
        );
        continue;
      }

      appointment.status = AppointmentStatus.CANCELLED_BY_DOCTOR;
      appointment.cancellationReason = `医生停诊：${reason}`;
      appointment.cancelledAt = format(cancelTime, "yyyy-MM-dd HH:mm:ss");
      validCancellations.push(appointment);

      const notification = this.notificationRepo.create({
        patientId: appointment.patientId,
        type: NotificationType.DOCTOR_CANCELLED,
        title: "医生停诊通知",
        content: `抱歉，${schedule.doctor.name}医生${appointment.appointmentDate} ${appointment.appointmentTime}的出诊已取消。原因：${reason}。请重新预约。`,
        relatedAppointmentId: appointment.id,
      });
      notifications.push(notification);
    }

    if (specificDate) {
      const tempSchedule = this.scheduleRepo.create({
        doctorId: schedule.doctorId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        appointmentDuration: schedule.appointmentDuration,
        status: ScheduleStatus.CANCELLED,
        specificDate,
        cancellationReason: reason,
        cancelledAt: format(cancelTime, "yyyy-MM-dd HH:mm:ss"),
      });
      await this.scheduleRepo.save(tempSchedule);
    } else {
      schedule.status = ScheduleStatus.CANCELLED;
      schedule.cancellationReason = reason;
      schedule.cancelledAt = format(cancelTime, "yyyy-MM-dd HH:mm:ss");
      await this.scheduleRepo.save(schedule);
    }

    await this.appointmentRepo.save(validCancellations);
    await this.notificationRepo.save(notifications);

    return { cancelledAppointments: validCancellations, notifications };
  }

  async getWeeklySchedule(
    doctorId: number,
    startDate: string
  ): Promise<Array<{ date: string; schedules: DoctorSchedule[] }>> {
    const result = [];
    const start = new Date(startDate);

    for (let i = 0; i < 7; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const dateStr = format(current, "yyyy-MM-dd");
      const dayOfWeek = current.getDay();

      const schedules = await this.scheduleRepo.find({
        where: [
          { doctorId, dayOfWeek: dayOfWeek as any, status: ScheduleStatus.ACTIVE },
          {
            doctorId,
            specificDate: dateStr,
            status: ScheduleStatus.ACTIVE,
          },
        ],
      });

      result.push({ date: dateStr, schedules });
    }

    return result;
  }
}
