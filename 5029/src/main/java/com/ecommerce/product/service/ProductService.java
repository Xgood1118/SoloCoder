package com.ecommerce.product.service;

import com.ecommerce.product.dto.ProductCreateRequest;
import com.ecommerce.product.dto.TieredPriceRequest;
import com.ecommerce.product.entity.Product;
import com.ecommerce.product.entity.Sku;
import com.ecommerce.product.entity.TieredPrice;
import com.ecommerce.product.repository.ProductRepository;
import com.ecommerce.product.repository.SkuRepository;
import com.ecommerce.product.repository.TieredPriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final SkuRepository skuRepository;
    private final TieredPriceRepository tieredPriceRepository;

    @Transactional
    public Product createProduct(ProductCreateRequest request) {
        Product product = new Product();
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setCategory(request.getCategory());
        product.setImageUrl(request.getImageUrl());
        product.setOnSale(true);

        if (request.getSkus() != null) {
            for (ProductCreateRequest.SkuRequest skuReq : request.getSkus()) {
                Sku sku = new Sku();
                sku.setSkuCode(skuReq.getSkuCode());
                sku.setAttributes(skuReq.getAttributes());
                sku.setPrice(skuReq.getPrice());
                sku.setCostPrice(skuReq.getCostPrice());
                product.addSku(sku);
            }
        }

        return productRepository.save(product);
    }

    @Transactional
    public Product updateProduct(Long id, ProductCreateRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));

        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setCategory(request.getCategory());
        product.setImageUrl(request.getImageUrl());

        return productRepository.save(product);
    }

    public Product getProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
    }

    public List<Product> listProducts() {
        return productRepository.findAll();
    }

    public List<Product> listOnSaleProducts() {
        return productRepository.findByOnSaleTrue();
    }

    @Transactional
    public void toggleOnSale(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
        product.setOnSale(!product.getOnSale());
        productRepository.save(product);
    }

    @Transactional
    public Sku addSku(Long productId, ProductCreateRequest.SkuRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));

        Sku sku = new Sku();
        sku.setSkuCode(request.getSkuCode());
        sku.setAttributes(request.getAttributes());
        sku.setPrice(request.getPrice());
        sku.setCostPrice(request.getCostPrice());
        product.addSku(sku);

        return skuRepository.save(sku);
    }

    public List<Sku> listSkusByProduct(Long productId) {
        return skuRepository.findByProductId(productId);
    }

    @Transactional
    public TieredPrice addTieredPrice(Long skuId, TieredPriceRequest request) {
        Sku sku = skuRepository.findById(skuId)
                .orElseThrow(() -> new IllegalArgumentException("SKU not found: " + skuId));

        TieredPrice tieredPrice = new TieredPrice();
        tieredPrice.setSku(sku);
        tieredPrice.setMinQuantity(request.getMinQuantity());
        tieredPrice.setMaxQuantity(request.getMaxQuantity());
        tieredPrice.setUnitPrice(request.getUnitPrice());

        return tieredPriceRepository.save(tieredPrice);
    }

    public List<TieredPrice> getTieredPrices(Long skuId) {
        return tieredPriceRepository.findBySkuIdOrderByMinQuantityAsc(skuId);
    }

    public BigDecimal resolvePrice(Long skuId, Integer quantity) {
        List<TieredPrice> tieredPrices = tieredPriceRepository.findBySkuIdOrderByMinQuantityAsc(skuId);

        for (TieredPrice tp : tieredPrices) {
            if (quantity >= tp.getMinQuantity() && quantity <= tp.getMaxQuantity()) {
                return tp.getUnitPrice();
            }
        }

        Sku sku = skuRepository.findById(skuId)
                .orElseThrow(() -> new IllegalArgumentException("SKU not found: " + skuId));
        return sku.getPrice();
    }
}
