package com.ecommerce.order.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class AmountUtil {
    private static final BigDecimal SCALE = new BigDecimal("100");
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    public static long yuanToFen(String yuanStr) {
        if (yuanStr == null || yuanStr.trim().isEmpty()) {
            return 0;
        }
        BigDecimal yuan = new BigDecimal(yuanStr.trim());
        return yuan.multiply(SCALE).setScale(0, ROUNDING_MODE).longValueExact();
    }

    public static long yuanToFen(BigDecimal yuan) {
        if (yuan == null) {
            return 0;
        }
        return yuan.multiply(SCALE).setScale(0, ROUNDING_MODE).longValueExact();
    }

    public static String fenToYuan(long fen) {
        return BigDecimal.valueOf(fen).divide(SCALE, 2, ROUNDING_MODE).toPlainString();
    }

    public static BigDecimal fenToBigDecimal(long fen) {
        return BigDecimal.valueOf(fen).divide(SCALE, 2, ROUNDING_MODE);
    }

    public static long calculateDiscount(long totalAmount, long threshold, long discount) {
        if (totalAmount >= threshold && threshold > 0) {
            long count = totalAmount / threshold;
            long totalDiscount = multiply(discount, (int) count);
            return Math.min(totalDiscount, totalAmount);
        }
        return 0;
    }

    public static long add(long... amounts) {
        BigDecimal sum = BigDecimal.ZERO;
        for (long amount : amounts) {
            sum = sum.add(BigDecimal.valueOf(amount));
        }
        return sum.setScale(0, ROUNDING_MODE).longValueExact();
    }

    public static long subtract(long a, long b) {
        return BigDecimal.valueOf(a).subtract(BigDecimal.valueOf(b))
                .setScale(0, ROUNDING_MODE).longValueExact();
    }

    public static long multiply(long amount, int multiplier) {
        return BigDecimal.valueOf(amount).multiply(BigDecimal.valueOf(multiplier))
                .setScale(0, ROUNDING_MODE).longValueExact();
    }
}
