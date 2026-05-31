package com.ticket.system.statemachine;

public enum TicketStatusEvent {
    CONFIRM,
    ACCEPT,
    START_PROCESSING,
    SUBMIT_FOR_ACCEPTANCE,
    ACCEPT_SOLUTION,
    REJECT_SOLUTION,
    CLOSE,
    CANCEL,
    REOPEN
}
