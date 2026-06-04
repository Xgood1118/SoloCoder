package com.ecommerce.promotion.service;

import com.ecommerce.promotion.dto.PromotionCalculateRequest;
import com.ecommerce.promotion.dto.PromotionCalculateResult;
import com.ecommerce.promotion.entity.Coupon;
import com.ecommerce.promotion.entity.Promotion;
import com.ecommerce.promotion.entity.PromotionType;
import com.ecommerce.promotion.repository.CouponRepository;
import com.ecommerce.promotion.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final CouponRepository couponRepository;

    @Transactional
    public Promotion createPromotion(Promotion promotion) {
        return promotionRepository.save(promotion);
    }

    public Promotion getPromotion(Long id) {
        return promotionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Promotion not found: " + id));
    }

    public List<Promotion> listActivePromotions() {
        return promotionRepository.findByActiveTrueOrderByPriorityAsc();
    }

    @Transactional
    public void deactivatePromotion(Long id) {
        Promotion promotion = getPromotion(id);
        promotion.setActive(false);
        promotionRepository.save(promotion);
    }

    @Transactional
    public Coupon createCoupon(Coupon coupon) {
        return couponRepository.save(coupon);
    }

    public Coupon getCouponByCode(String code) {
        return couponRepository.findByCode(code)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found: " + code));
    }

    @Transactional
    public void useCoupon(String code) {
        Coupon coupon = getCouponByCode(code);
        if (!coupon.isValid()) {
            throw new IllegalStateException("Coupon is not valid: " + code);
        }
        coupon.setUsedQuantity(coupon.getUsedQuantity() + 1);
        couponRepository.save(coupon);
    }

    public PromotionCalculateResult calculatePromotions(PromotionCalculateRequest request) {
        PromotionCalculateResult result = new PromotionCalculateResult();

        BigDecimal originalAmount = request.getItems().stream()
                .map(PromotionCalculateRequest.OrderItemInfo::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        result.setOriginalAmount(originalAmount);
        result.setDiscountDetails(new ArrayList<>());

        List<Promotion> activePromotions = promotionRepository.findByActiveTrueOrderByPriorityAsc();
        List<Promotion> applicablePromotions = activePromotions.stream()
                .filter(Promotion::isCurrentlyActive)
                .collect(Collectors.toList());

        BigDecimal remainingAmount = originalAmount;

        for (Promotion promotion : applicablePromotions) {
            if (!isApplicable(promotion, request)) {
                continue;
            }

            BigDecimal discount = calculateDiscount(promotion, remainingAmount, request);
            if (discount.compareTo(BigDecimal.ZERO) > 0) {
                remainingAmount = remainingAmount.subtract(discount);

                PromotionCalculateResult.DiscountDetail detail = new PromotionCalculateResult.DiscountDetail();
                detail.setPromotionName(promotion.getName());
                detail.setPromotionType(promotion.getType().name());
                detail.setDiscountAmount(discount);
                detail.setDescription(buildDescription(promotion, discount));
                result.getDiscountDetails().add(detail);
            }
        }

        if (request.getCouponCode() != null && !request.getCouponCode().isBlank()) {
            Coupon coupon = couponRepository.findByCode(request.getCouponCode()).orElse(null);
            if (coupon != null && coupon.isValid() && isCouponApplicable(coupon, request)) {
                if (remainingAmount.compareTo(coupon.getThresholdAmount()) >= 0) {
                    BigDecimal couponDiscount = coupon.getDeductionAmount();
                    if (couponDiscount.compareTo(remainingAmount) > 0) {
                        couponDiscount = remainingAmount;
                    }
                    remainingAmount = remainingAmount.subtract(couponDiscount);

                    PromotionCalculateResult.DiscountDetail detail = new PromotionCalculateResult.DiscountDetail();
                    detail.setPromotionName(coupon.getName());
                    detail.setPromotionType(PromotionType.COUPON.name());
                    detail.setDiscountAmount(couponDiscount);
                    detail.setDescription("Coupon " + coupon.getCode() + " deducted " + couponDiscount);
                    result.getDiscountDetails().add(detail);
                }
            }
        }

        BigDecimal totalDiscount = originalAmount.subtract(remainingAmount);
        if (totalDiscount.compareTo(BigDecimal.ZERO) < 0) {
            totalDiscount = BigDecimal.ZERO;
            remainingAmount = originalAmount;
        }

        result.setTotalDiscount(totalDiscount);
        result.setFinalAmount(remainingAmount);

        return result;
    }

    private boolean isApplicable(Promotion promotion, PromotionCalculateRequest request) {
        if (promotion.getApplicableProductIds() == null || promotion.getApplicableProductIds().isBlank()) {
            return true;
        }

        List<Long> applicableIds = Arrays.stream(promotion.getApplicableProductIds().split(","))
                .map(String::trim)
                .map(Long::parseLong)
                .collect(Collectors.toList());

        return request.getItems().stream()
                .anyMatch(item -> applicableIds.contains(item.getProductId()));
    }

    private boolean isCouponApplicable(Coupon coupon, PromotionCalculateRequest request) {
        if (coupon.getApplicableProductIds() == null || coupon.getApplicableProductIds().isBlank()) {
            return true;
        }

        List<Long> applicableIds = Arrays.stream(coupon.getApplicableProductIds().split(","))
                .map(String::trim)
                .map(Long::parseLong)
                .collect(Collectors.toList());

        return request.getItems().stream()
                .anyMatch(item -> applicableIds.contains(item.getProductId()));
    }

    private BigDecimal calculateDiscount(Promotion promotion, BigDecimal currentAmount, PromotionCalculateRequest request) {
        return switch (promotion.getType()) {
            case FULL_REDUCTION -> calculateFullReduction(promotion, currentAmount, request);
            case DISCOUNT -> calculateDiscountRate(promotion, currentAmount, request);
            case BUY_GIFT -> BigDecimal.ZERO;
            case COUPON -> BigDecimal.ZERO;
        };
    }

    private BigDecimal calculateFullReduction(Promotion promotion, BigDecimal currentAmount, PromotionCalculateRequest request) {
        BigDecimal applicableAmount = getApplicableAmount(promotion, request);
        if (applicableAmount.compareTo(promotion.getThresholdAmount()) >= 0) {
            return promotion.getReductionAmount();
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal calculateDiscountRate(Promotion promotion, BigDecimal currentAmount, PromotionCalculateRequest request) {
        BigDecimal applicableAmount = getApplicableAmount(promotion, request);
        if (promotion.getThresholdAmount() == null || applicableAmount.compareTo(promotion.getThresholdAmount()) >= 0) {
            BigDecimal discount = applicableAmount.multiply(BigDecimal.ONE.subtract(promotion.getDiscountRate()));
            return discount.setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal getApplicableAmount(Promotion promotion, PromotionCalculateRequest request) {
        if (promotion.getApplicableProductIds() == null || promotion.getApplicableProductIds().isBlank()) {
            return request.getItems().stream()
                    .map(PromotionCalculateRequest.OrderItemInfo::getSubtotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        List<Long> applicableIds = Arrays.stream(promotion.getApplicableProductIds().split(","))
                .map(String::trim)
                .map(Long::parseLong)
                .collect(Collectors.toList());

        return request.getItems().stream()
                .filter(item -> applicableIds.contains(item.getProductId()))
                .map(PromotionCalculateRequest.OrderItemInfo::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String buildDescription(Promotion promotion, BigDecimal discount) {
        return switch (promotion.getType()) {
            case FULL_REDUCTION -> "Full " + promotion.getThresholdAmount() + " reduction " + promotion.getReductionAmount() + ", saved " + discount;
            case DISCOUNT -> "Discount " + promotion.getDiscountRate() + ", saved " + discount;
            case BUY_GIFT -> "Buy " + promotion.getThresholdAmount() + " get " + promotion.getGiftQuantity() + " free";
            case COUPON -> "Coupon deducted " + discount;
        };
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void scheduledPromotionStatusCheck() {
        LocalDateTime now = LocalDateTime.now();

        List<Promotion> activePromotions = promotionRepository.findByActiveTrueOrderByPriorityAsc();
        for (Promotion promotion : activePromotions) {
            if (now.isAfter(promotion.getEndTime())) {
                promotion.setActive(false);
                promotionRepository.save(promotion);
                log.info("Promotion auto-deactivated: id={}, name={}", promotion.getId(), promotion.getName());
            }
        }

        List<Coupon> coupons = couponRepository.findAll();
        for (Coupon coupon : coupons) {
            if (coupon.getActive() && now.isAfter(coupon.getEndTime())) {
                coupon.setActive(false);
                couponRepository.save(coupon);
                log.info("Coupon auto-deactivated: id={}, code={}", coupon.getId(), coupon.getCode());
            }
        }
    }
}
