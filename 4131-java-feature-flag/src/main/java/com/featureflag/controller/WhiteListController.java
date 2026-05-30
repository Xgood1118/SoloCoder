package com.featureflag.controller;

import com.featureflag.entity.WhiteList;
import com.featureflag.service.WhiteListService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/feature-flags/{flagId}/whitelist")
@RequiredArgsConstructor
public class WhiteListController {

    private final WhiteListService whiteListService;

    @GetMapping
    public ResponseEntity<List<WhiteList>> getWhiteList(@PathVariable Long flagId) {
        List<WhiteList> whiteList = whiteListService.getWhiteListByFlag(flagId);
        return ResponseEntity.ok(whiteList);
    }

    @PostMapping("/users")
    public ResponseEntity<WhiteList> addUser(
            @PathVariable Long flagId,
            @RequestParam String userId,
            @RequestParam(required = false) String description,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        WhiteList entry = whiteListService.addUserToWhiteList(flagId, userId, description, operator);
        return ResponseEntity.ok(entry);
    }

    @PostMapping("/tags")
    public ResponseEntity<WhiteList> addTag(
            @PathVariable Long flagId,
            @RequestParam String userTag,
            @RequestParam(required = false) String description,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        WhiteList entry = whiteListService.addTagToWhiteList(flagId, userTag, description, operator);
        return ResponseEntity.ok(entry);
    }

    @PostMapping("/users/batch")
    public ResponseEntity<Void> batchAddUsers(
            @PathVariable Long flagId,
            @RequestBody List<String> userIds,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String operator) {
        whiteListService.batchAddUsers(flagId, userIds, operator);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{whiteListId}")
    public ResponseEntity<Void> removeFromWhiteList(@PathVariable Long whiteListId) {
        whiteListService.removeFromWhiteList(whiteListId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> clearWhiteList(@PathVariable Long flagId) {
        whiteListService.clearWhiteList(flagId);
        return ResponseEntity.ok().build();
    }
}
