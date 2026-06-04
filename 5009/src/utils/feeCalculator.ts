import { Patient, PatientMemberLevel } from "../entities/Patient";
import { Doctor, DoctorTitle } from "../entities/Doctor";
import { Department } from "../entities/Department";

export class FeeCalculator {
  private static titleFeeMultipliers: Record<DoctorTitle, number> = {
    [DoctorTitle.INTERN]: 1.0,
    [DoctorTitle.RESIDENT]: 1.2,
    [DoctorTitle.ATTENDING]: 1.5,
    [DoctorTitle.CHIEF]: 2.0,
  };

  private static memberDiscounts: Record<PatientMemberLevel, number> = {
    [PatientMemberLevel.NORMAL]: 0,
    [PatientMemberLevel.SILVER]: 0.05,
    [PatientMemberLevel.GOLD]: 0.1,
    [PatientMemberLevel.PLATINUM]: 0.2,
  };

  static calculateRegistrationFee(
    department: Department,
    doctor: Doctor,
    patient: Patient
  ): { originalFee: number; actualFee: number; discount: number } {
    const baseFee = department.baseRegistrationFee;
    const titleMultiplier =
      doctor.titleFeeMultiplier > 0
        ? doctor.titleFeeMultiplier
        : this.titleFeeMultipliers[doctor.title] || 1;

    const originalFee = baseFee * titleMultiplier;
    const discount = this.memberDiscounts[patient.memberLevel] || 0;
    const actualFee = originalFee * (1 - discount);

    return {
      originalFee: Math.round(originalFee * 100) / 100,
      actualFee: Math.round(actualFee * 100) / 100,
      discount: discount * 100,
    };
  }

  static getMemberDiscount(level: PatientMemberLevel): number {
    return this.memberDiscounts[level] || 0;
  }

  static getTitleFeeMultiplier(title: DoctorTitle): number {
    return this.titleFeeMultipliers[title] || 1;
  }
}
