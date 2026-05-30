package com.bpm.engine.api.controller;

import com.bpm.engine.api.dto.MessageCorrelateRequest;
import com.bpm.engine.api.dto.MessageSendRequest;
import com.bpm.engine.api.dto.R;
import com.bpm.engine.api.dto.SignalBroadcastRequest;
import com.bpm.engine.runtime.signal.MessageService;
import com.bpm.engine.runtime.signal.SignalService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bpm/signal-message")
@RequiredArgsConstructor
public class SignalMessageController {

    private final SignalService signalService;
    private final MessageService messageService;

    @PostMapping("/signal/broadcast")
    public R<Void> broadcastSignal(@RequestBody SignalBroadcastRequest request) {
        signalService.broadcastSignal(request.getSignalId(), request.getPayload());
        return R.ok();
    }

    @PostMapping("/message/send")
    public R<Void> sendMessage(@RequestBody MessageSendRequest request) {
        messageService.sendMessage(request.getMessageId(),
                request.getTargetProcessInstanceId(),
                request.getTargetExecutionId(),
                request.getPayload());
        return R.ok();
    }

    @PostMapping("/message/correlate")
    public R<Void> correlateMessage(@RequestBody MessageCorrelateRequest request) {
        messageService.correlateMessage(request.getMessageName(),
                request.getBusinessKey(),
                request.getPayload());
        return R.ok();
    }
}
