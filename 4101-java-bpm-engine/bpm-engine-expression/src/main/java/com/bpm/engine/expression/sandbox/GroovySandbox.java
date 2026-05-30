package com.bpm.engine.expression.sandbox;

import com.bpm.engine.common.exception.ExpressionEvaluationException;
import groovy.lang.GroovyClassLoader;
import org.codehaus.groovy.control.CompilerConfiguration;
import org.codehaus.groovy.control.customizers.SecureASTCustomizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

@Component
public class GroovySandbox {

    private static final Logger log = LoggerFactory.getLogger(GroovySandbox.class);

    private final SandboxConfig sandboxConfig;
    private final ExecutorService executorService;

    public GroovySandbox(SandboxConfig sandboxConfig) {
        this.sandboxConfig = sandboxConfig;
        this.executorService = Executors.newCachedThreadPool();
    }

    public Object evaluateSandboxed(String expression, Map<String, Object> variables) {
        CompilerConfiguration config = createCompilerConfiguration();
        GroovyClassLoader classLoader = new GroovyClassLoader(getClass().getClassLoader(), config);

        Future<Object> future = executorService.submit(() -> {
            Class<?> scriptClass = classLoader.parseClass(expression);
            groovy.lang.Script script = (groovy.lang.Script) scriptClass.getDeclaredConstructor().newInstance();
            if (variables != null) {
                script.getBinding().getVariables().putAll(variables);
            }
            Object result = script.run();

            if (result != null && result.toString().length() > sandboxConfig.getMaxOutputLength()) {
                throw new ExpressionEvaluationException("SANDBOX_OUTPUT_LIMIT",
                        "Output exceeded maximum length of " + sandboxConfig.getMaxOutputLength());
            }
            return result;
        });

        try {
            return future.get(sandboxConfig.getMaxCpuTimeMs(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new ExpressionEvaluationException("SANDBOX_CPU_TIMEOUT",
                    "Expression evaluation timed out after " + sandboxConfig.getMaxCpuTimeMs() + "ms");
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof ExpressionEvaluationException) {
                throw (ExpressionEvaluationException) cause;
            }
            logSecurityViolation(expression, cause);
            throw new ExpressionEvaluationException("SANDBOX_VIOLATION",
                    "Sandbox security violation during evaluation", cause);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ExpressionEvaluationException("SANDBOX_INTERRUPTED",
                    "Expression evaluation was interrupted");
        } finally {
            try {
                classLoader.close();
            } catch (Exception ignored) {
            }
        }
    }

    private CompilerConfiguration createCompilerConfiguration() {
        CompilerConfiguration config = new CompilerConfiguration();
        SecureASTCustomizer secureCustomizer = new SecureASTCustomizer();

        secureCustomizer.setImportsWhitelist(sandboxConfig.getAllowedClasses());
        secureCustomizer.setStarImportsWhitelist(sandboxConfig.getAllowedClasses());

        List<String> blocked = new ArrayList<>(sandboxConfig.getBlockedClasses());
        secureCustomizer.setImportsBlacklist(blocked);

        secureCustomizer.setReceiversBlackList(List.of(
                "java.lang.Runtime",
                "java.lang.ProcessBuilder",
                "java.lang.System",
                "java.lang.ClassLoader",
                "java.lang.Thread"
        ));

        secureCustomizer.setIndirectImportCheckEnabled(true);

        config.addCompilationCustomizers(secureCustomizer);
        return config;
    }

    private void logSecurityViolation(String expression, Throwable cause) {
        log.warn("Groovy sandbox security violation - expression: {}, error: {}",
                expression, cause != null ? cause.getMessage() : "unknown");
    }
}
