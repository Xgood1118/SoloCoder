package com.etl.cleaning;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;
import java.util.Map;

public class ScriptExecutor {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(ScriptExecutor.class);

    private final ScriptEngine engine;

    public ScriptExecutor() {
        ScriptEngineManager manager = new ScriptEngineManager();
        this.engine = manager.getEngineByName("groovy");
    }

    public Object execute(String script, Map<String, Object> bindings) {
        try {
            if (bindings != null) {
                for (Map.Entry<String, Object> entry : bindings.entrySet()) {
                    engine.put(entry.getKey(), entry.getValue());
                }
            }
            return engine.eval(script);
        } catch (ScriptException e) {
            logger.error("Script execution failed: {}", e.getMessage(), e);
            throw new RuntimeException("Script execution failed", e);
        }
    }
}
