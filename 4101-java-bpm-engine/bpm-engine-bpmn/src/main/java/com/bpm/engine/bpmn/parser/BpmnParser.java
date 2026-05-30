package com.bpm.engine.bpmn.parser;

import com.bpm.engine.bpmn.model.BpmnProcess;

import java.io.InputStream;

public interface BpmnParser {

    BpmnProcess parse(String xml);

    BpmnProcess parse(InputStream inputStream);
}
