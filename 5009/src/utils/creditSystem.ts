import { differenceInHours } from "date-fns";
import { Patient } from "../entities/Patient";

export enum CancellationWindow {
  MORE_THAN_24H = "超过24小时",
  WITHIN_24H = "24小时内",
  SAME_DAY = "当天",
}

export class CreditSystem {
  private static readonly CANCELLATION_POINTS_WITHIN_24H = 5;
  private static readonly CANCELLATION_POINTS_SAME_DAY = 10;
  private static readonly NO_SHOW_POINTS = 15;
  private static readonly BREACH_THRESHOLD = 3;
  private static readonly MINIMUM_SCORE_FOR_BOOKING = 60;

  static calculateCancellationType(
    appointmentDateTime: Date,
    cancellationTime: Date
  ): CancellationWindow {
    const hoursDiff = differenceInHours(appointmentDateTime, cancellationTime);

    if (hoursDiff >= 24) {
      return CancellationWindow.MORE_THAN_24H;
    }

    const appointmentDate = new Date(appointmentDateTime).toDateString();
    const cancelDate = new Date(cancellationTime).toDateString();

    if (appointmentDate === cancelDate) {
      return CancellationWindow.SAME_DAY;
    }

    return CancellationWindow.WITHIN_24H;
  }

  static calculatePointsToDeduct(
    appointmentDateTime: Date,
    cancellationTime: Date
  ): number {
    const window = this.calculateCancellationType(
      appointmentDateTime,
      cancellationTime
    );

    switch (window) {
      case CancellationWindow.MORE_THAN_24H:
        return 0;
      case CancellationWindow.WITHIN_24H:
        return this.CANCELLATION_POINTS_WITHIN_24H;
      case CancellationWindow.SAME_DAY:
        return this.CANCELLATION_POINTS_SAME_DAY;
    }
  }

  static processCancellation(
    patient: Patient,
    appointmentDateTime: Date,
    cancellationTime: Date
  ): {
    pointsDeducted: number; isBreach: boolean; bookingStillAllowed: boolean } {
    const pointsDeducted = this.calculatePointsToDeduct(
      appointmentDateTime,
      cancellationTime
    );
    const window = this.calculateCancellationType(
      appointmentDateTime,
      cancellationTime
    );

    const isBreach = window === CancellationWindow.SAME_DAY;

    let newScore = patient.creditScore - pointsDeducted;
    let newConsecutiveBreaches = isBreach
      ? patient.consecutiveBreaches + 1
      : patient.consecutiveBreaches;

    if (!isBreach && pointsDeducted === 0) {
      newConsecutiveBreaches = 0;
    }

    const bookingAllowed =
      newScore >= this.MINIMUM_SCORE_FOR_BOOKING &&
      newConsecutiveBreaches < this.BREACH_THRESHOLD;

    return {
      pointsDeducted,
      isBreach,
      bookingStillAllowed: bookingAllowed,
    };
  }

  static processNoShow(patient: Patient): {
    newScore: number; newBreaches: number; bookingAllowed: boolean } {
    const newScore = patient.creditScore - this.NO_SHOW_POINTS;
    const newBreaches = patient.consecutiveBreaches + 1;
    const bookingAllowed =
      newScore >= this.MINIMUM_SCORE_FOR_BOOKING &&
      newBreaches < this.BREACH_THRESHOLD;

    return { newScore, newBreaches, bookingAllowed };
  }

  static canBook(patient: Patient): boolean {
    return (
      patient.bookingAllowed &&
      patient.creditScore >= this.MINIMUM_SCORE_FOR_BOOKING &&
      patient.consecutiveBreaches < this.BREACH_THRESHOLD
    );
  }

  static restoreCredit(patient: Patient, points: number): number {
    return Math.min(100, patient.creditScore + points);
  }
}
