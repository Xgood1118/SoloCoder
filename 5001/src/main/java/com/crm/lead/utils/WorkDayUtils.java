package com.crm.lead.utils;

import java.util.Calendar;
import java.util.Date;

public class WorkDayUtils {

    public static int getWorkDaysBetween(Date start, Date end) {
        if (start == null || end == null) {
            return 0;
        }
        if (start.after(end)) {
            return -getWorkDaysBetween(end, start);
        }

        Calendar cal = Calendar.getInstance();
        cal.setTime(start);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        start = cal.getTime();

        cal.setTime(end);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        end = cal.getTime();

        int workDays = 0;
        cal.setTime(start);

        while (cal.getTime().before(end)) {
            int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK);
            if (dayOfWeek != Calendar.SATURDAY && dayOfWeek != Calendar.SUNDAY) {
                workDays++;
            }
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }

        return workDays;
    }

    public static Date addWorkDays(Date date, int workDays) {
        if (date == null || workDays == 0) {
            return date;
        }

        Calendar cal = Calendar.getInstance();
        cal.setTime(date);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        int direction = workDays > 0 ? 1 : -1;
        int remaining = Math.abs(workDays);

        while (remaining > 0) {
            cal.add(Calendar.DAY_OF_MONTH, direction);
            int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK);
            if (dayOfWeek != Calendar.SATURDAY && dayOfWeek != Calendar.SUNDAY) {
                remaining--;
            }
        }

        return cal.getTime();
    }

    public static int calculateWorkDays(Date start, Date end) {
        return getWorkDaysBetween(start, end);
    }
}
