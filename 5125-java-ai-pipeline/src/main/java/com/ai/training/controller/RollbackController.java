package com.ai.training.controller;

import com.ai.training.common.Result;
import com.ai.training.dto.RollbackDTO;
import com.ai.training.entity.RollbackRecord;
import com.ai.training.service.RollbackService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/rollbacks")
public class RollbackController {

    @Autowired
    private RollbackService rollbackService;

    @PostMapping
    public Result<RollbackRecord> rollback(@Valid @RequestBody RollbackDTO dto) {
        return Result.success(rollbackService.rollback(dto));
    }

    @GetMapping("/{id}")
    public Result<RollbackRecord> getRollbackRecord(@PathVariable Long id) {
        return Result.success(rollbackService.getRollbackRecord(id));
    }

    @GetMapping("/task/{taskId}")
    public Result<List<RollbackRecord>> getRollbackRecordsByTaskId(@PathVariable Long taskId) {
        return Result.success(rollbackService.getRollbackRecordsByTaskId(taskId));
    }
}
