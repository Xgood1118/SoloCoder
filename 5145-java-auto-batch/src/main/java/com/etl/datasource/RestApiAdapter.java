package com.etl.datasource;

import com.etl.model.DataSourceConfig;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

public class RestApiAdapter extends AbstractDataSourceAdapter {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private String baseUrl;
    private Map<String, String> headers;

    @Override
    protected void doConnect(DataSourceConfig config) throws Exception {
        Map<String, String> extraParams = config.getExtraParams();
        if (extraParams == null) {
            throw new IllegalArgumentException("REST API adapter requires extraParams with 'url' and optional 'headers'");
        }
        this.baseUrl = extraParams.get("url");
        if (this.baseUrl == null || this.baseUrl.isEmpty()) {
            throw new IllegalArgumentException("REST API adapter requires 'url' in extraParams");
        }
        this.headers = extraParams;
        HttpURLConnection connection = createConnection(baseUrl, "GET");
        int responseCode = connection.getResponseCode();
        connection.disconnect();
        if (responseCode >= 400) {
            throw new RuntimeException("REST API connectivity check failed with response code: " + responseCode);
        }
    }

    @Override
    protected void doDisconnect() {
        this.baseUrl = null;
        this.headers = null;
    }

    @Override
    public Iterator<Map<String, Object>> executeQuery(String query) {
        try {
            List<Map<String, Object>> allResults = new ArrayList<>();
            String currentUrl = query != null && !query.isEmpty() ? query : baseUrl;

            while (currentUrl != null) {
                HttpURLConnection connection = createConnection(currentUrl, "GET");
                String response = readResponse(connection);
                connection.disconnect();

                Map<String, Object> responseMap = objectMapper.readValue(response, Map.class);
                Object data = responseMap.get("data");
                if (data instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> items = (List<Map<String, Object>>) data;
                    allResults.addAll(items);
                }

                Object nextPage = responseMap.get("nextPage");
                currentUrl = (nextPage != null && !nextPage.toString().isEmpty()) ? nextPage.toString() : null;
            }

            return allResults.iterator();
        } catch (Exception e) {
            handleException(e);
            throw new RuntimeException("Failed to execute REST API query: " + query, e);
        }
    }

    @Override
    public void executeWrite(String targetTable, List<Map<String, Object>> records, List<String> columnOrder) {
        if (records == null || records.isEmpty()) {
            return;
        }

        try {
            String url = (targetTable != null && !targetTable.isEmpty()) ? targetTable : baseUrl;
            HttpURLConnection connection = createConnection(url, "POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");

            String jsonBody = objectMapper.writeValueAsString(records);
            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = connection.getResponseCode();
            connection.disconnect();
            if (responseCode >= 400) {
                throw new RuntimeException("REST API write failed with response code: " + responseCode);
            }
        } catch (Exception e) {
            handleException(e);
            throw new RuntimeException("Failed to execute REST API write", e);
        }
    }

    @Override
    public String getAdapterType() {
        return "REST_API";
    }

    private HttpURLConnection createConnection(String urlStr, String method) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(config != null ? config.getConnectionTimeout() : 30000);
        connection.setReadTimeout(config != null ? config.getConnectionTimeout() : 30000);
        if (headers != null) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                String key = entry.getKey();
                if (!"url".equals(key)) {
                    connection.setRequestProperty(key, entry.getValue());
                }
            }
        }
        return connection;
    }

    private String readResponse(HttpURLConnection connection) throws Exception {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            return response.toString();
        }
    }
}
