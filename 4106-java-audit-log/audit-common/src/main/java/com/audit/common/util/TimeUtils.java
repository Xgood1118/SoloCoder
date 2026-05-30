package com.audit.common.util;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

public final class TimeUtils {

    private TimeUtils() {
    }

    public static Instant toUtc(ZonedDateTime local) {
        return local.toInstant();
    }

    public static ZonedDateTime fromUtc(Instant utc, ZoneId targetZone) {
        return utc.atZone(targetZone);
    }

    public static String formatUtc(Instant instant) {
        return DateTimeFormatter.ISO_INSTANT.format(instant);
    }

    public static ZonedDateTime handleYearBoundary(Instant utc, ZoneId zone) {
        ZonedDateTime zdt = utc.atZone(zone);
        ZonedDateTime utcZdt = utc.atZone(ZoneId.of("UTC"));
        if (zdt.getYear() != utcZdt.getYear()) {
            return utcZdt;
        }
        return zdt;
    }
}
