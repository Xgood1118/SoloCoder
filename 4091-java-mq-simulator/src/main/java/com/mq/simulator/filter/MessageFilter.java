package com.mq.simulator.filter;

import com.mq.simulator.model.ConsumedMessage;
import com.mq.simulator.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public class MessageFilter {
    private static final Logger logger = LoggerFactory.getLogger(MessageFilter.class);

    private List<FilterCondition> conditions;
    private boolean matchAll = true;

    public MessageFilter() {
        this.conditions = new ArrayList<>();
    }

    public MessageFilter addCondition(FilterCondition condition) {
        this.conditions.add(condition);
        return this;
    }

    public MessageFilter addContentContains(String keyword) {
        return addCondition(new ContentContainsCondition(keyword));
    }

    public MessageFilter addHeaderEquals(String headerKey, String expectedValue) {
        return addCondition(new HeaderEqualsCondition(headerKey, expectedValue));
    }

    public MessageFilter addTopicMatches(String pattern) {
        return addCondition(new TopicMatchesCondition(pattern));
    }

    public MessageFilter addJsonPathEquals(String jsonPath, Object expectedValue) {
        return addCondition(new JsonPathCondition(jsonPath, expectedValue));
    }

    public void setMatchAll(boolean matchAll) {
        this.matchAll = matchAll;
    }

    public boolean isMatchAll() {
        return matchAll;
    }

    public int getConditionCount() {
        return conditions.size();
    }

    public List<FilterCondition> getConditions() {
        return new ArrayList<>(conditions);
    }

    public boolean matches(Message message) {
        if (conditions.isEmpty()) {
            return true;
        }

        for (FilterCondition condition : conditions) {
            boolean matches = condition.matches(message);
            if (matchAll && !matches) {
                return false;
            }
            if (!matchAll && matches) {
                return true;
            }
        }

        return matchAll;
    }

    public boolean matches(ConsumedMessage message) {
        if (conditions.isEmpty()) {
            return true;
        }

        for (FilterCondition condition : conditions) {
            boolean matches = condition.matches(message);
            if (matchAll && !matches) {
                return false;
            }
            if (!matchAll && matches) {
                return true;
            }
        }

        return matchAll;
    }

    public FilterResult applyFilter(ConsumedMessage message) {
        FilterResult result = new FilterResult();
        result.setMessage(message);

        if (conditions.isEmpty()) {
            result.setPassed(true);
            return result;
        }

        List<String> failedReasons = new ArrayList<>();
        for (FilterCondition condition : conditions) {
            if (!condition.matches(message)) {
                failedReasons.add(condition.getDescription());
            }
        }

        if (matchAll) {
            result.setPassed(failedReasons.isEmpty());
        } else {
            result.setPassed(failedReasons.size() < conditions.size());
        }

        if (!result.isPassed()) {
            message.setFiltered(true);
            message.setFilterReason(String.join("; ", failedReasons));
        }

        return result;
    }

    public List<Message> filterMessages(List<Message> messages) {
        List<Message> filtered = new ArrayList<>();
        for (Message message : messages) {
            if (matches(message)) {
                filtered.add(message);
            }
        }
        return filtered;
    }

    public List<ConsumedMessage> filterConsumedMessages(List<ConsumedMessage> messages) {
        List<ConsumedMessage> filtered = new ArrayList<>();
        for (ConsumedMessage message : messages) {
            if (matches(message)) {
                filtered.add(message);
            }
        }
        return filtered;
    }

    public interface FilterCondition {
        boolean matches(Message message);

        boolean matches(ConsumedMessage message);

        String getDescription();
    }

    public static class ContentContainsCondition implements FilterCondition {
        private final String keyword;
        private final boolean caseSensitive;

        public ContentContainsCondition(String keyword) {
            this(keyword, false);
        }

        public ContentContainsCondition(String keyword, boolean caseSensitive) {
            this.keyword = caseSensitive ? keyword : keyword.toLowerCase();
            this.caseSensitive = caseSensitive;
        }

        @Override
        public boolean matches(Message message) {
            return matchesContent(message.getContent());
        }

        @Override
        public boolean matches(ConsumedMessage message) {
            return matchesContent(message.getContent());
        }

        private boolean matchesContent(String content) {
            if (content == null) {
                return false;
            }
            String toMatch = caseSensitive ? content : content.toLowerCase();
            return toMatch.contains(keyword);
        }

        @Override
        public String getDescription() {
            return "Content contains '" + keyword + "'";
        }
    }

    public static class HeaderEqualsCondition implements FilterCondition {
        private final String headerKey;
        private final String expectedValue;

        public HeaderEqualsCondition(String headerKey, String expectedValue) {
            this.headerKey = headerKey;
            this.expectedValue = expectedValue;
        }

        @Override
        public boolean matches(Message message) {
            Map<String, String> headers = message.getHeaders();
            if (headers == null) {
                return false;
            }
            String actualValue = headers.get(headerKey);
            return expectedValue.equals(actualValue);
        }

        @Override
        public boolean matches(ConsumedMessage message) {
            return false;
        }

        @Override
        public String getDescription() {
            return "Header '" + headerKey + "' equals '" + expectedValue + "'";
        }
    }

    public static class TopicMatchesCondition implements FilterCondition {
        private final Pattern pattern;
        private final String patternStr;

        public TopicMatchesCondition(String pattern) {
            this.patternStr = pattern;
            String regex = pattern.replace(".", "\\.").replace("*", ".*").replace("#", ".*");
            this.pattern = Pattern.compile(regex);
        }

        @Override
        public boolean matches(Message message) {
            String topic = message.getTopic() != null ? message.getTopic() : message.getRoutingKey();
            return topic != null && pattern.matcher(topic).matches();
        }

        @Override
        public boolean matches(ConsumedMessage message) {
            return message.getTopic() != null && pattern.matcher(message.getTopic()).matches();
        }

        @Override
        public String getDescription() {
            return "Topic matches pattern '" + patternStr + "'";
        }
    }

    public static class JsonPathCondition implements FilterCondition {
        private final String jsonPath;
        private final Object expectedValue;

        public JsonPathCondition(String jsonPath, Object expectedValue) {
            this.jsonPath = jsonPath;
            this.expectedValue = expectedValue;
        }

        @Override
        public boolean matches(Message message) {
            return matchesContent(message.getContent());
        }

        @Override
        public boolean matches(ConsumedMessage message) {
            return matchesContent(message.getContent());
        }

        private boolean matchesContent(String content) {
            if (content == null) {
                return false;
            }
            try {
                String[] paths = jsonPath.replace("$.", "").split("\\.");
                com.fasterxml.jackson.databind.JsonNode node =
                        new com.fasterxml.jackson.databind.ObjectMapper().readTree(content);

                for (String path : paths) {
                    if (node == null) {
                        return false;
                    }
                    if (path.contains("[")) {
                        String fieldName = path.substring(0, path.indexOf("["));
                        int index = Integer.parseInt(path.substring(path.indexOf("[") + 1, path.indexOf("]")));
                        node = node.get(fieldName);
                        if (node != null && node.isArray()) {
                            node = node.get(index);
                        }
                    } else {
                        node = node.get(path);
                    }
                }

                if (node == null) {
                    return false;
                }

                String actualValue;
                if (node.isTextual()) {
                    actualValue = node.asText();
                } else if (node.isNumber()) {
                    actualValue = String.valueOf(node.asLong());
                } else if (node.isBoolean()) {
                    actualValue = String.valueOf(node.asBoolean());
                } else {
                    actualValue = node.toString();
                }

                return String.valueOf(expectedValue).equals(actualValue);
            } catch (Exception e) {
                logger.debug("Failed to parse JSON for filtering: {}", e.getMessage());
                return false;
            }
        }

        @Override
        public String getDescription() {
            return "JSON path '" + jsonPath + "' equals '" + expectedValue + "'";
        }
    }

    public static class FilterResult {
        private ConsumedMessage message;
        private boolean passed;
        private String filterReason;

        public ConsumedMessage getMessage() {
            return message;
        }

        public void setMessage(ConsumedMessage message) {
            this.message = message;
        }

        public boolean isPassed() {
            return passed;
        }

        public void setPassed(boolean passed) {
            this.passed = passed;
        }

        public String getFilterReason() {
            return filterReason;
        }

        public void setFilterReason(String filterReason) {
            this.filterReason = filterReason;
        }
    }
}
