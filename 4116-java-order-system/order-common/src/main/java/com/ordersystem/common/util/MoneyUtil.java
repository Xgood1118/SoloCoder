package com.ordersystem.common.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class MoneyUtil {

    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    private final BigDecimal amount;

    private MoneyUtil(BigDecimal amount) {
        this.amount = amount.setScale(SCALE, ROUNDING_MODE);
    }

    public static MoneyUtil of(String value) {
        return new MoneyUtil(new BigDecimal(value));
    }

    public static MoneyUtil of(BigDecimal value) {
        return new MoneyUtil(value);
    }

    public MoneyUtil add(MoneyUtil other) {
        return new MoneyUtil(this.amount.add(other.amount));
    }

    public MoneyUtil subtract(MoneyUtil other) {
        return new MoneyUtil(this.amount.subtract(other.amount));
    }

    public MoneyUtil multiply(BigDecimal factor) {
        return new MoneyUtil(this.amount.multiply(factor));
    }

    public MoneyUtil divide(BigDecimal divisor) {
        return new MoneyUtil(this.amount.divide(divisor, SCALE, ROUNDING_MODE));
    }

    public String toYuan() {
        return amount.setScale(SCALE, ROUNDING_MODE).toPlainString();
    }

    public boolean isPositive() {
        return amount.compareTo(BigDecimal.ZERO) > 0;
    }

    public boolean isNegative() {
        return amount.compareTo(BigDecimal.ZERO) < 0;
    }

    public static MoneyUtil zero() {
        return new MoneyUtil(BigDecimal.ZERO);
    }

    public BigDecimal getAmount() {
        return amount;
    }
}
