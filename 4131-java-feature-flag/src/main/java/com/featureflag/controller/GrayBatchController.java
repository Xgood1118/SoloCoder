package com.featureflag.controller;

import com.featureflag.entity.GrayBatch;
import com.featureflag.service.GrayBatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/feature-flags/{flagId}/gray-batches")
@RequiredArgsConstructor
public class GrayBatchController {

    private final GrayBatchService grayBatchService;

    @GetMapping
    public ResponseEntity<List<GrayBatch>> getBatches(@PathVariable Long flagId) {
        List<GrayBatch> batches = grayBatchService.getBatchesByFlag(flagId);
        return ResponseEntity.ok(batches);
    }

    @PostMapping
    public ResponseEntity<GrayBatch> createBatch(
            @PathVariable Long flagId,
            @RequestBody GrayBatch batch,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        GrayBatch created = grayBatchService.createBatch(flagId, batch, operator);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{batchId}")
    public ResponseEntity<GrayBatch> updateBatch(
            @PathVariable Long batchId,
            @RequestBody GrayBatch batch,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        GrayBatch updated = grayBatchService.updateBatch(batchId, batch, operator);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{batchId}")
    public ResponseEntity<Void> deleteBatch(@PathVariable Long batchId) {
        grayBatchService.deleteBatch(batchId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{batchId}/toggle")
    public ResponseEntity<GrayBatch> toggleBatch(
            @PathVariable Long batchId,
            @RequestParam boolean enabled,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        GrayBatch updated = grayBatchService.toggleBatch(batchId, enabled, operator);
        return ResponseEntity.ok(updated);
    }
}
