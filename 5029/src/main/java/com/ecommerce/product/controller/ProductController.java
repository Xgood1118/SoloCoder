package com.ecommerce.product.controller;

import com.ecommerce.common.ApiResponse;
import com.ecommerce.product.dto.ProductCreateRequest;
import com.ecommerce.product.dto.TieredPriceRequest;
import com.ecommerce.product.entity.Product;
import com.ecommerce.product.entity.Sku;
import com.ecommerce.product.entity.TieredPrice;
import com.ecommerce.product.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @PostMapping
    public ApiResponse<Product> createProduct(@Valid @RequestBody ProductCreateRequest request) {
        return ApiResponse.success(productService.createProduct(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<Product> updateProduct(@PathVariable Long id, @Valid @RequestBody ProductCreateRequest request) {
        return ApiResponse.success(productService.updateProduct(id, request));
    }

    @GetMapping("/{id}")
    public ApiResponse<Product> getProduct(@PathVariable Long id) {
        return ApiResponse.success(productService.getProduct(id));
    }

    @GetMapping
    public ApiResponse<List<Product>> listProducts() {
        return ApiResponse.success(productService.listProducts());
    }

    @GetMapping("/on-sale")
    public ApiResponse<List<Product>> listOnSaleProducts() {
        return ApiResponse.success(productService.listOnSaleProducts());
    }

    @PutMapping("/{id}/toggle-sale")
    public ApiResponse<Void> toggleOnSale(@PathVariable Long id) {
        productService.toggleOnSale(id);
        return ApiResponse.success();
    }

    @PostMapping("/{productId}/skus")
    public ApiResponse<Sku> addSku(@PathVariable Long productId, @Valid @RequestBody ProductCreateRequest.SkuRequest request) {
        return ApiResponse.success(productService.addSku(productId, request));
    }

    @GetMapping("/{productId}/skus")
    public ApiResponse<List<Sku>> listSkusByProduct(@PathVariable Long productId) {
        return ApiResponse.success(productService.listSkusByProduct(productId));
    }

    @PostMapping("/skus/{skuId}/tiered-prices")
    public ApiResponse<TieredPrice> addTieredPrice(@PathVariable Long skuId, @Valid @RequestBody TieredPriceRequest request) {
        return ApiResponse.success(productService.addTieredPrice(skuId, request));
    }

    @GetMapping("/skus/{skuId}/tiered-prices")
    public ApiResponse<List<TieredPrice>> getTieredPrices(@PathVariable Long skuId) {
        return ApiResponse.success(productService.getTieredPrices(skuId));
    }

    @GetMapping("/skus/{skuId}/price")
    public ApiResponse<BigDecimal> resolvePrice(@PathVariable Long skuId, @RequestParam Integer quantity) {
        return ApiResponse.success(productService.resolvePrice(skuId, quantity));
    }
}
