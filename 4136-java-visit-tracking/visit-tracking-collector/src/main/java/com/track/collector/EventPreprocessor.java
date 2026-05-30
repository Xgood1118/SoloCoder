package com.track.collector;

import com.track.common.entity.ClickEvent;
import com.track.common.entity.HeartbeatEvent;
import com.track.common.entity.VisitEvent;
import com.track.common.enums.EventStatus;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.stream.Collectors;

@Component
public class EventPreprocessor {

    public void preprocessVisit(VisitEvent event, long epochMillis) {
        event.setPageUrl(normalizeUrl(event.getPageUrl()));
        if (event.getReferrer() != null) {
            event.setReferrer(event.getReferrer().trim());
            if (event.getReferrer().isEmpty()) {
                event.setReferrer(null);
            }
        }
        event.setTimestamp(epochToLocalDateTime(epochMillis));
        event.setStatus(EventStatus.VALIDATED);
    }

    public void preprocessHeartbeat(HeartbeatEvent event, long epochMillis) {
        event.setPageUrl(normalizeUrl(event.getPageUrl()));
        event.setTimestamp(epochToLocalDateTime(epochMillis));
    }

    public void preprocessClick(ClickEvent event, long epochMillis) {
        event.setPageUrl(normalizeUrl(event.getPageUrl()));
        event.setTimestamp(epochToLocalDateTime(epochMillis));
        if (event.getRelativeX() != null) {
            event.setRelativeX(Math.max(0.0, Math.min(1.0, event.getRelativeX())));
        }
        if (event.getRelativeY() != null) {
            event.setRelativeY(Math.max(0.0, Math.min(1.0, event.getRelativeY())));
        }
        event.setStatus(EventStatus.VALIDATED);
    }

    private String normalizeUrl(String url) {
        if (url == null || url.isBlank()) {
            return url;
        }
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
            String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";
            int port = uri.getPort();
            String path = uri.getPath();
            String query = uri.getQuery();

            if (path == null) {
                path = "";
            }
            path = path.replaceAll("/+$", "");
            if (path.isEmpty()) {
                path = "/";
            }

            if (query != null && !query.isEmpty()) {
                String sortedQuery = Arrays.stream(query.split("&"))
                        .sorted()
                        .collect(Collectors.joining("&"));
                query = sortedQuery;
            }

            StringBuilder normalized = new StringBuilder();
            normalized.append(scheme).append("://").append(host);
            if (port > 0 && !((scheme.equals("http") && port == 80) || (scheme.equals("https") && port == 443))) {
                normalized.append(":").append(port);
            }
            normalized.append(path);
            if (query != null && !query.isEmpty()) {
                normalized.append("?").append(query);
            }
            return normalized.toString();
        } catch (Exception e) {
            return url.trim();
        }
    }

    private LocalDateTime epochToLocalDateTime(long epochMillis) {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneOffset.UTC);
    }
}
