use metrics_collector::*;
use std::sync::Arc;

#[test]
fn test_counter_basic() {
    let registry = MetricRegistry::new();
    let counter = registry
        .register_counter("test_counter".to_string(), "A test counter".to_string())
        .unwrap();

    let labels = vec![("method".to_string(), "GET".to_string())];

    assert_eq!(counter.get(&labels), 0.0);
    counter.inc(&labels);
    assert_eq!(counter.get(&labels), 1.0);
    counter.inc_by(&labels, 5.0);
    assert_eq!(counter.get(&labels), 6.0);

    let labels2 = vec![("method".to_string(), "POST".to_string())];
    counter.inc(&labels2);
    assert_eq!(counter.get(&labels2), 1.0);
    assert_eq!(counter.get(&labels), 6.0);
}

#[test]
fn test_counter_no_negative() {
    let registry = MetricRegistry::new();
    let counter = registry
        .register_counter("test_counter_neg".to_string(), "Test".to_string())
        .unwrap();

    let labels = vec![];
    counter.inc_by(&labels, 5.0);
    counter.inc_by(&labels, -1.0);
    assert_eq!(counter.get(&labels), 5.0);
}

#[test]
fn test_gauge_operations() {
    let registry = MetricRegistry::new();
    let gauge = registry
        .register_gauge("test_gauge".to_string(), "A test gauge".to_string())
        .unwrap();

    let labels = vec![];

    gauge.set(&labels, 42.0);
    assert_eq!(gauge.get(&labels), 42.0);

    gauge.inc(&labels);
    assert_eq!(gauge.get(&labels), 43.0);

    gauge.inc_by(&labels, 7.0);
    assert_eq!(gauge.get(&labels), 50.0);

    gauge.dec(&labels);
    assert_eq!(gauge.get(&labels), 49.0);

    gauge.dec_by(&labels, 9.0);
    assert_eq!(gauge.get(&labels), 40.0);
}

#[test]
fn test_histogram_basic() {
    let registry = MetricRegistry::new();
    let buckets = vec![0.1, 0.5, 1.0, 5.0];
    let histogram = registry
        .register_histogram(
            "test_histogram".to_string(),
            "A test histogram".to_string(),
            Some(buckets),
        )
        .unwrap();

    let labels = vec![];

    histogram.observe(&labels, 0.05);
    histogram.observe(&labels, 0.2);
    histogram.observe(&labels, 0.7);
    histogram.observe(&labels, 2.0);
    histogram.observe(&labels, 10.0);

    let values = histogram.values.lock();
    let data = values.get(&labels).unwrap();

    assert_eq!(data.count, 5);
    assert_eq!(data.sum, 0.05 + 0.2 + 0.7 + 2.0 + 10.0);
    assert_eq!(data.buckets[0].count, 1);
    assert_eq!(data.buckets[1].count, 2);
    assert_eq!(data.buckets[2].count, 3);
    assert_eq!(data.buckets[3].count, 4);
}

#[test]
fn test_summary_quantiles() {
    let registry = MetricRegistry::new();
    let summary = registry
        .register_summary("test_summary".to_string(), "A test summary".to_string())
        .unwrap();

    let labels = vec![];

    for i in 1..=100 {
        summary.observe(&labels, i as f64);
    }

    let values = summary.values.lock();
    let data = values.get(&labels).unwrap();

    assert_eq!(data.count, 100);
    assert_eq!(data.sum, (1..=100).sum::<u32>() as f64);

    assert!(data.quantiles[0].value >= 45.0 && data.quantiles[0].value <= 55.0);
    assert!(data.quantiles[1].value >= 85.0 && data.quantiles[1].value <= 95.0);
    assert!(data.quantiles[2].value >= 95.0 && data.quantiles[2].value <= 100.0);
}

#[test]
fn test_labels_separation() {
    let registry = MetricRegistry::new();
    let counter = registry
        .register_counter("requests_total".to_string(), "Total requests".to_string())
        .unwrap();

    let labels_a = vec![
        ("method".to_string(), "GET".to_string()),
        ("path".to_string(), "/users".to_string()),
    ];
    let labels_b = vec![
        ("method".to_string(), "POST".to_string()),
        ("path".to_string(), "/users".to_string()),
    ];
    let labels_c = vec![
        ("path".to_string(), "/users".to_string()),
        ("method".to_string(), "GET".to_string()),
    ];

    counter.inc_by(&labels_a, 10.0);
    counter.inc_by(&labels_b, 20.0);

    assert_eq!(counter.get(&labels_a), 10.0);
    assert_eq!(counter.get(&labels_b), 20.0);
    assert_eq!(counter.get(&labels_c), 10.0);
}

#[test]
fn test_hot_update_get_or_create() {
    let registry = MetricRegistry::new();

    let counter1 = registry.get_or_create_counter("dynamic".to_string(), "Dynamic metric".to_string());
    let labels = vec![];
    counter1.inc(&labels);

    let counter2 = registry.get_or_create_counter("dynamic".to_string(), "Dynamic metric".to_string());
    counter2.inc(&labels);

    assert_eq!(counter1.get(&labels), 2.0);
    assert_eq!(counter2.get(&labels), 2.0);
    assert!(Arc::ptr_eq(&counter1, &counter2));
}

#[test]
fn test_prometheus_format_counter() {
    let registry = MetricRegistry::new();
    let counter = registry
        .register_counter(
            "http_requests_total".to_string(),
            "Total HTTP requests".to_string(),
        )
        .unwrap();

    let labels = vec![
        ("method".to_string(), "GET".to_string()),
        ("status".to_string(), "200".to_string()),
    ];
    counter.inc_by(&labels, 42.0);

    let output = format_registry(&registry);

    assert!(output.contains("# HELP http_requests_total Total HTTP requests"));
    assert!(output.contains("# TYPE http_requests_total counter"));
    assert!(output.contains("http_requests_total{method=\"GET\",status=\"200\"} 42"));
}

#[test]
fn test_prometheus_format_histogram() {
    let registry = MetricRegistry::new();
    let buckets = vec![0.1, 0.5, 1.0];
    let histogram = registry
        .register_histogram(
            "request_duration".to_string(),
            "Request duration".to_string(),
            Some(buckets),
        )
        .unwrap();

    let labels = vec![("service".to_string(), "api".to_string())];
    histogram.observe(&labels, 0.05);
    histogram.observe(&labels, 0.3);
    histogram.observe(&labels, 0.7);

    let output = format_registry(&registry);

    assert!(output.contains("# TYPE request_duration histogram"));
    assert!(output.contains("request_duration_bucket{service=\"api\",le=\"0.1\"} 1"));
    assert!(output.contains("request_duration_bucket{service=\"api\",le=\"0.5\"} 2"));
    assert!(output.contains("request_duration_bucket{service=\"api\",le=\"1\"} 3"));
    assert!(output.contains("request_duration_sum{service=\"api\"} 1.05"));
    assert!(output.contains("request_duration_count{service=\"api\"} 3"));
}

#[test]
fn test_high_cardinality_detection() {
    let registry = MetricRegistry::new();
    let counter = registry
        .register_counter(
            "high_card_test".to_string(),
            "Test high cardinality".to_string(),
        )
        .unwrap();

    for i in 0..105 {
        let labels = vec![("user_id".to_string(), format!("user_{}", i))];
        counter.inc(&labels);
    }

    let warnings = registry.check_high_cardinality();
    assert_eq!(warnings.len(), 1);
    assert_eq!(warnings[0].0, "high_card_test");
    assert_eq!(warnings[0].1, 105);
    assert_eq!(warnings[0].2, 100);
}

#[test]
fn test_push_instance_cleanup() {
    let registry = MetricRegistry::new();
    let counter = registry
        .register_counter("test_push".to_string(), "Test push".to_string())
        .unwrap();

    let labels1 = vec![
        ("instance".to_string(), "node-1".to_string()),
        ("service".to_string(), "api".to_string()),
    ];
    let labels2 = vec![
        ("instance".to_string(), "node-2".to_string()),
        ("service".to_string(), "api".to_string()),
    ];

    counter.inc(&labels1);
    counter.inc(&labels2);
    assert_eq!(counter.cardinality(), 2);

    registry.record_push("node-1".to_string(), 1);
    registry.record_push("node-2".to_string(), 100);

    std::thread::sleep(std::time::Duration::from_millis(1100));

    let expired = registry.cleanup_expired_instances();
    assert_eq!(expired.len(), 1);
    assert_eq!(expired[0], "node-1");

    let values = counter.values.lock();
    assert_eq!(values.len(), 1);
    assert!(values.contains_key(&labels_to_key(&labels2)));
}

#[test]
fn test_metric_type_enum() {
    assert_eq!(MetricType::Counter.as_str(), "counter");
    assert_eq!(MetricType::Gauge.as_str(), "gauge");
    assert_eq!(MetricType::Histogram.as_str(), "histogram");
    assert_eq!(MetricType::Summary.as_str(), "summary");
}

#[test]
fn test_register_duplicate() {
    let registry = MetricRegistry::new();
    registry
        .register_counter("dup_test".to_string(), "Test".to_string())
        .unwrap();

    let result = registry.register_counter("dup_test".to_string(), "Test 2".to_string());
    assert!(result.is_err());
}

#[tokio::test]
async fn test_concurrent_updates() {
    let registry = MetricRegistry::new();
    let counter = registry
        .register_counter("concurrent_test".to_string(), "Test".to_string())
        .unwrap();

    let counter_clone = counter.clone();
    let handle = std::thread::spawn(move || {
        let labels = vec![];
        for _ in 0..1000 {
            counter_clone.inc(&labels);
        }
    });

    let labels = vec![];
    for _ in 0..1000 {
        counter.inc(&labels);
    }

    handle.join().unwrap();
    assert_eq!(counter.get(&labels), 2000.0);
}
