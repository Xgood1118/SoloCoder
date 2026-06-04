package com.ecommerce.promotion.controller;

import com.ecommerce.common.ApiResponse;
import com.ecommerce.promotion.dto.PromotionCalculateRequest;
import com.ecommerce.promotion.dto.PromotionCalculateResult;
import com.ecommerce.promotion.entity.Coupon;
import com.ecommerce.promotion.entity.Promotion;
import com.ecommerce.promotion.service.PromotionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/promotions")
@RequiredArgsConstructor
public class PromotionController {

    private final PromotionService promotionService;

    @PostMapping
    public ApiResponse<Promotion> createPromotion(@RequestBody Promotion promotion) {
        return ApiResponse.success(promotionService.createPromotion(promotion));
    }

    @GetMapping("/{id}")
    public ApiResponse<Promotion> getPromotion(@PathVariable Long id) {
        return ApiResponse.success(promotionService.getPromotion(id));
    }

    @GetMapping("/active")
    public ApiResponse<List<Promotion>> listActivePromotions() {
        return ApiResponse.success(promotionService.listActivePromotions());
    }

    @PutMapping("/{id}/deactivate")
    public ApiResponse<Void> deactivatePromotion(@PathVariable Long id) {
        promotionService.deactivatePromotion(id);
        return ApiResponse.success();
    }

    @PostMapping("/coupons")
    public ApiResponse<Coupon> createCoupon(@RequestBody Coupon coupon) {
        return ApiResponse.success(promotionService.createCoupon(coupon));
    }

    @GetMapping("/coupons/{code}")
    public ApiResponse<Coupon> getCouponByCode(@PathVariable String code) {
        return ApiResponse.success(promotionService.getCouponByCode(code));
    }

    @PostMapping("/calculate")
    public ApiResponse<PromotionCalculateResult> calculatePromotions(@RequestBody PromotionCalculateRequest request) {
        return ApiResponse.success(promotionService.calculatePromotions(request));
    }
}
