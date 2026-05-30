package com.bpm.engine.bpmn.parser;

import com.bpm.engine.bpmn.model.*;
import com.bpm.engine.common.enums.*;
import com.bpm.engine.common.exception.ProcessDefinitionException;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.DocumentHelper;
import org.dom4j.Element;
import org.dom4j.io.SAXReader;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class BpmnXmlParser implements BpmnParser {

    private static final String BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";

    @Override
    public BpmnProcess parse(String xml) {
        try {
            Document document = DocumentHelper.parseText(xml);
            return parseDocument(document);
        } catch (DocumentException e) {
            throw new ProcessDefinitionException("PARSE_ERROR", "Failed to parse BPMN XML", e);
        }
    }

    @Override
    public BpmnProcess parse(InputStream inputStream) {
        try {
            SAXReader reader = new SAXReader();
            Document document = reader.read(new InputStreamReader(inputStream, StandardCharsets.UTF_8));
            return parseDocument(document);
        } catch (DocumentException e) {
            throw new ProcessDefinitionException("PARSE_ERROR", "Failed to parse BPMN XML from input stream", e);
        }
    }

    private BpmnProcess parseDocument(Document document) {
        Element definitions = document.getRootElement();
        BpmnProcess process = new BpmnProcess();

        parseSignals(definitions, process);
        parseMessages(definitions, process);

        Element processElement = findChild(definitions, BPMN_NS, "process");
        if (processElement == null) {
            throw new ProcessDefinitionException("PARSE_ERROR", "No process element found in BPMN XML");
        }

        process.setProcessKey(processElement.attributeValue("id"));
        process.setName(processElement.attributeValue("name"));
        String versionStr = processElement.attributeValue("version");
        if (versionStr != null) {
            process.setVersion(Integer.parseInt(versionStr));
        }
        process.setCategory(processElement.attributeValue("category"));
        process.setExecutable("true".equals(processElement.attributeValue("isExecutable")));

        parseDocumentation(processElement, process.getDocumentation());

        Map<String, SequenceFlow> sequenceFlowMap = new LinkedHashMap<>();
        for (Element seqFlow : childElements(processElement, BPMN_NS, "sequenceFlow")) {
            SequenceFlow flow = parseSequenceFlow(seqFlow);
            sequenceFlowMap.put(flow.getFlowId(), flow);
        }
        process.setSequenceFlows(new ArrayList<>(sequenceFlowMap.values()));

        for (Element element : processElement.elements()) {
            String localName = element.getQualifiedName();
            if (element.getNamespaceURI() != null && !element.getNamespaceURI().isEmpty()) {
                localName = element.getName();
            }
            FlowNode node = parseFlowNode(element, localName, sequenceFlowMap);
            if (node != null) {
                process.getFlowNodes().add(node);
            }
        }

        return process;
    }

    private FlowNode parseFlowNode(Element element, String localName, Map<String, SequenceFlow> sequenceFlowMap) {
        FlowNode node = new FlowNode();
        node.setNodeId(element.attributeValue("id"));
        node.setName(element.attributeValue("name"));
        node.setDocumentation(parseElementDocumentation(element));

        String incoming;
        String outgoing;

        switch (localName) {
            case "startEvent":
                node.setNodeType(NodeType.START_EVENT);
                parseIncomingOutgoing(element, node);
                return node;
            case "endEvent":
                node.setNodeType(NodeType.END_EVENT);
                parseIncomingOutgoing(element, node);
                return node;
            case "userTask":
                node.setNodeType(NodeType.USER_TASK);
                parseIncomingOutgoing(element, node);
                parseUserTask(element, node);
                return node;
            case "serviceTask":
                node.setNodeType(NodeType.SERVICE_TASK);
                parseIncomingOutgoing(element, node);
                parseServiceTask(element, node);
                return node;
            case "scriptTask":
                node.setNodeType(NodeType.SCRIPT_TASK);
                parseIncomingOutgoing(element, node);
                return node;
            case "exclusiveGateway":
                node.setNodeType(NodeType.EXCLUSIVE_GATEWAY);
                parseIncomingOutgoing(element, node);
                parseGateway(element, node, GatewayType.EXCLUSIVE);
                return node;
            case "parallelGateway":
                node.setNodeType(NodeType.PARALLEL_GATEWAY);
                parseIncomingOutgoing(element, node);
                parseGateway(element, node, GatewayType.PARALLEL);
                return node;
            case "inclusiveGateway":
                node.setNodeType(NodeType.INCLUSIVE_GATEWAY);
                parseIncomingOutgoing(element, node);
                parseGateway(element, node, GatewayType.INCLUSIVE);
                return node;
            case "eventGateway":
                node.setNodeType(NodeType.EVENT_GATEWAY);
                parseIncomingOutgoing(element, node);
                parseGateway(element, node, GatewayType.EVENT);
                return node;
            case "boundaryEvent":
                node.setNodeType(NodeType.BOUNDARY_EVENT);
                parseBoundaryEvent(element, node);
                return node;
            case "subProcess":
                node.setNodeType(NodeType.SUBPROCESS);
                parseIncomingOutgoing(element, node);
                parseSubProcess(element, node, true);
                return node;
            case "callActivity":
                node.setNodeType(NodeType.CALL_ACTIVITY);
                parseIncomingOutgoing(element, node);
                parseCallActivity(element, node);
                return node;
            case "intermediateCatchEvent":
                node.setNodeType(NodeType.INTERMEDIATE_CATCH_EVENT);
                parseIncomingOutgoing(element, node);
                return node;
            case "intermediateThrowEvent":
                node.setNodeType(NodeType.INTERMEDIATE_THROW_EVENT);
                parseIncomingOutgoing(element, node);
                return node;
            default:
                return null;
        }
    }

    private void parseIncomingOutgoing(Element element, FlowNode node) {
        for (Element incoming : childElements(element, BPMN_NS, "incoming")) {
            node.getIncomingFlows().add(incoming.getTextTrim());
        }
        for (Element outgoing : childElements(element, BPMN_NS, "outgoing")) {
            node.getOutgoingFlows().add(outgoing.getTextTrim());
        }
    }

    private SequenceFlow parseSequenceFlow(Element element) {
        SequenceFlow flow = new SequenceFlow();
        flow.setFlowId(element.attributeValue("id"));
        flow.setName(element.attributeValue("name"));
        flow.setSourceRef(element.attributeValue("sourceRef"));
        flow.setTargetRef(element.attributeValue("targetRef"));

        Element conditionExpr = findChild(element, BPMN_NS, "conditionExpression");
        if (conditionExpr != null) {
            flow.setConditionExpression(conditionExpr.getTextTrim());
            String language = conditionExpr.attributeValue("language");
            String type = conditionExpr.attributeValue("type");
            if (type != null && type.contains("tFormalExpression")) {
                flow.setConditionType(ExpressionType.UEL);
            } else if ("groovy".equalsIgnoreCase(language)) {
                flow.setConditionType(ExpressionType.GROOVY);
            } else if ("spel".equalsIgnoreCase(language)) {
                flow.setConditionType(ExpressionType.SPEL);
            } else {
                flow.setConditionType(ExpressionType.UEL);
            }
        }

        return flow;
    }

    private void parseUserTask(Element element, FlowNode node) {
        UserTaskConfig config = new UserTaskConfig();
        config.setAssigneeExpression(element.attributeValue("assignee"));
        config.setFormKey(element.attributeValue("formKey"));
        config.setDueDateExpression(element.attributeValue("dueDate"));
        config.setPriorityExpression(element.attributeValue("priority"));

        String candidateUsers = element.attributeValue("candidateUsers");
        if (candidateUsers != null && !candidateUsers.isEmpty()) {
            config.setCandidateUsers(Arrays.asList(candidateUsers.split(",")));
        }

        String candidateGroups = element.attributeValue("candidateGroups");
        if (candidateGroups != null && !candidateGroups.isEmpty()) {
            config.setCandidateGroups(Arrays.asList(candidateGroups.split(",")));
        }

        node.setUserTaskConfig(config);
        parseMultiInstance(element, node);
    }

    private void parseServiceTask(Element element, FlowNode node) {
        ServiceTaskConfig config = new ServiceTaskConfig();

        String clazz = element.attributeValue("class");
        String expression = element.attributeValue("expression");
        String delegateExpression = element.attributeValue("delegateExpression");

        if (clazz != null) {
            config.setImplementation("class");
            config.setImplementationValue(clazz);
        } else if (expression != null) {
            config.setImplementation("expression");
            config.setImplementationValue(expression);
        } else if (delegateExpression != null) {
            config.setImplementation("delegateExpression");
            config.setImplementationValue(delegateExpression);
        }

        config.setResultVariable(element.attributeValue("resultVariable"));
        node.setServiceTaskConfig(config);
        parseMultiInstance(element, node);
    }

    private void parseGateway(Element element, FlowNode node, GatewayType gatewayType) {
        GatewayConfig config = new GatewayConfig();
        config.setGatewayType(gatewayType);
        node.setGatewayConfig(config);
    }

    private void parseBoundaryEvent(Element element, FlowNode node) {
        BoundaryEventConfig config = new BoundaryEventConfig();
        config.setAttachedToRef(element.attributeValue("attachedToRef"));
        config.setCancelActivity(!"false".equals(element.attributeValue("cancelActivity")));

        Element timerDef = findChild(element, BPMN_NS, "timerEventDefinition");
        if (timerDef != null) {
            config.setEventType(BoundaryEventType.TIMER);
            config.setTimerConfig(parseTimerConfig(timerDef));
        }

        Element errorDef = findChild(element, BPMN_NS, "errorEventDefinition");
        if (errorDef != null) {
            config.setEventType(BoundaryEventType.ERROR);
            config.setErrorCode(errorDef.attributeValue("errorCode"));
        }

        Element messageDef = findChild(element, BPMN_NS, "messageEventDefinition");
        if (messageDef != null) {
            config.setEventType(BoundaryEventType.MESSAGE);
            config.setMessageRef(messageDef.attributeValue("messageRef"));
        }

        Element signalDef = findChild(element, BPMN_NS, "signalEventDefinition");
        if (signalDef != null) {
            config.setEventType(BoundaryEventType.SIGNAL);
            config.setSignalRef(signalDef.attributeValue("signalRef"));
        }

        node.setBoundaryEventConfig(config);
    }

    private TimerConfig parseTimerConfig(Element timerEventDefinition) {
        TimerConfig config = new TimerConfig();

        Element timeDuration = findChild(timerEventDefinition, BPMN_NS, "timeDuration");
        if (timeDuration != null) {
            config.setTimeDuration(timeDuration.getTextTrim());
        }

        Element timeDate = findChild(timerEventDefinition, BPMN_NS, "timeDate");
        if (timeDate != null) {
            config.setTimeDate(timeDate.getTextTrim());
        }

        Element timeCycle = findChild(timerEventDefinition, BPMN_NS, "timeCycle");
        if (timeCycle != null) {
            config.setTimeCycle(timeCycle.getTextTrim());
        }

        return config;
    }

    private void parseSubProcess(Element element, FlowNode node, boolean embedded) {
        SubProcessConfig config = new SubProcessConfig();
        config.setEmbedded(embedded);
        parseIoMapping(element, config);
        parseDataObjects(element, config);
        node.setSubProcessConfig(config);
        parseMultiInstance(element, node);
    }

    private void parseCallActivity(Element element, FlowNode node) {
        SubProcessConfig config = new SubProcessConfig();
        config.setEmbedded(false);
        config.setCalledElement(element.attributeValue("calledElement"));
        parseIoMapping(element, config);
        node.setSubProcessConfig(config);
    }

    private void parseIoMapping(Element element, SubProcessConfig config) {
        Element extensionElements = findChild(element, BPMN_NS, "extensionElements");
        if (extensionElements != null) {
            for (Element mapping : extensionElements.elements()) {
                String name = mapping.getName();
                if ("in".equals(name)) {
                    String source = mapping.attributeValue("source");
                    String target = mapping.attributeValue("target");
                    if (source != null && target != null) {
                        config.getInputMapping().put(target, source);
                    }
                } else if ("out".equals(name)) {
                    String source = mapping.attributeValue("source");
                    String target = mapping.attributeValue("target");
                    if (source != null && target != null) {
                        config.getOutputMapping().put(target, source);
                    }
                }
            }
        }
    }

    private void parseDataObjects(Element element, SubProcessConfig config) {
        for (Element dataObj : childElements(element, BPMN_NS, "dataObject")) {
            String id = dataObj.attributeValue("id");
            String name = dataObj.attributeValue("name");
            if (id != null && name != null) {
                config.getDataObjects().put(id, name);
            }
        }
    }

    private void parseMultiInstance(Element element, FlowNode node) {
        Element multiInstance = findChild(element, BPMN_NS, "multiInstanceLoopCharacteristics");
        if (multiInstance == null) {
            return;
        }

        MultiInstanceConfig config = new MultiInstanceConfig();
        boolean isSequential = "true".equals(multiInstance.attributeValue("isSequential"));
        config.setType(isSequential ? MultiInstanceType.SEQUENTIAL : MultiInstanceType.PARALLEL);

        Element loopCardinality = findChild(multiInstance, BPMN_NS, "loopCardinality");
        if (loopCardinality != null) {
            String text = loopCardinality.getTextTrim();
            try {
                config.setLoopCount(Integer.parseInt(text));
            } catch (NumberFormatException ignored) {
            }
        }

        Element collection = findChild(multiInstance, BPMN_NS, "collection");
        if (collection != null) {
            config.setCollectionExpression(collection.getTextTrim());
        }

        String collectionAttr = multiInstance.attributeValue("collection");
        if (collectionAttr != null) {
            config.setCollectionExpression(collectionAttr);
        }

        String variableAttr = multiInstance.attributeValue("variable");
        if (variableAttr != null) {
            config.setVariableName(variableAttr);
        }

        Element completionCondition = findChild(multiInstance, BPMN_NS, "completionCondition");
        if (completionCondition != null) {
            String conditionText = completionCondition.getTextTrim();
            if (conditionText != null) {
                if (conditionText.contains("nrOfCompletedInstances") && conditionText.contains("nrOfInstances")) {
                    config.setCompletionCondition(MultiInstanceCompletion.RATIO);
                    try {
                        String ratioStr = conditionText.replaceAll("[^0-9.]", "");
                        if (!ratioStr.isEmpty()) {
                            config.setCompletionRatio(Double.parseDouble(ratioStr));
                        }
                    } catch (NumberFormatException ignored) {
                    }
                } else if (conditionText.contains("nrOfCompletedInstances")) {
                    config.setCompletionCondition(MultiInstanceCompletion.ANY);
                } else {
                    config.setCompletionCondition(MultiInstanceCompletion.ALL);
                }
            }
        }

        node.setMultiInstanceConfig(config);
    }

    private void parseSignals(Element definitions, BpmnProcess process) {
        for (Element signal : childElements(definitions, BPMN_NS, "signal")) {
            SignalDefinition def = new SignalDefinition();
            def.setSignalId(signal.attributeValue("id"));
            def.setName(signal.attributeValue("name"));
            def.setScope(signal.attributeValue("scope"));
            process.getSignals().add(def);
        }
    }

    private void parseMessages(Element definitions, BpmnProcess process) {
        for (Element message : childElements(definitions, BPMN_NS, "message")) {
            MessageDefinition def = new MessageDefinition();
            def.setMessageId(message.attributeValue("id"));
            def.setName(message.attributeValue("name"));
            process.getMessages().add(def);
        }
    }

    private void parseDocumentation(Element element, Map<String, String> documentation) {
        for (Element doc : childElements(element, BPMN_NS, "documentation")) {
            String id = doc.attributeValue("id");
            String text = doc.getTextTrim();
            if (text != null && !text.isEmpty()) {
                documentation.put(id != null ? id : "doc_" + documentation.size(), text);
            }
        }
    }

    private String parseElementDocumentation(Element element) {
        Element doc = findChild(element, BPMN_NS, "documentation");
        return doc != null ? doc.getTextTrim() : null;
    }

    private Element findChild(Element parent, String namespaceUri, String localName) {
        for (Element child : parent.elements()) {
            if (localName.equals(child.getName()) && (namespaceUri == null || namespaceUri.equals(child.getNamespaceURI()))) {
                return child;
            }
        }
        return null;
    }

    private List<Element> childElements(Element parent, String namespaceUri, String localName) {
        List<Element> result = new ArrayList<>();
        for (Element child : parent.elements()) {
            if (localName.equals(child.getName()) && (namespaceUri == null || namespaceUri.equals(child.getNamespaceURI()))) {
                result.add(child);
            }
        }
        return result;
    }
}
