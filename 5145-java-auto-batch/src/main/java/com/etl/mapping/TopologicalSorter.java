package com.etl.mapping;

import com.etl.model.FieldMappingRule;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;

public class TopologicalSorter {

    public static List<FieldMappingRule> sort(List<FieldMappingRule> rules) {
        Map<String, FieldMappingRule> ruleByTarget = new HashMap<>();
        for (FieldMappingRule rule : rules) {
            ruleByTarget.put(rule.getTargetField(), rule);
        }

        Map<String, List<String>> adjacency = new HashMap<>();
        Map<String, Integer> inDegree = new HashMap<>();

        for (FieldMappingRule rule : rules) {
            String target = rule.getTargetField();
            adjacency.putIfAbsent(target, new ArrayList<>());
            inDegree.putIfAbsent(target, 0);
        }

        for (FieldMappingRule rule : rules) {
            String target = rule.getTargetField();
            if (rule.getDependencies() != null) {
                for (String dep : rule.getDependencies()) {
                    if (adjacency.containsKey(dep)) {
                        adjacency.get(dep).add(target);
                        inDegree.put(target, inDegree.getOrDefault(target, 0) + 1);
                    }
                }
            }
        }

        Queue<String> queue = new LinkedList<>();
        for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        List<FieldMappingRule> result = new ArrayList<>();
        while (!queue.isEmpty()) {
            String current = queue.poll();
            result.add(ruleByTarget.get(current));
            for (String successor : adjacency.getOrDefault(current, new ArrayList<>())) {
                int newDegree = inDegree.get(successor) - 1;
                inDegree.put(successor, newDegree);
                if (newDegree == 0) {
                    queue.add(successor);
                }
            }
        }

        if (result.size() != rules.size()) {
            throw new IllegalStateException("Circular dependency detected in field mapping rules");
        }

        return result;
    }
}
