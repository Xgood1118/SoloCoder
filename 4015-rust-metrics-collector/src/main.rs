use metrics_collector::{MetricRegistry, MetricsServer};
use std::net::SocketAddr;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let registry = MetricRegistry::new();

    let counter = registry
        .register_counter(
            "http_requests_total".to_string(),
            "Total number of HTTP requests".to_string(),
        )
        .expect("Failed to register counter");

    let gauge = registry
        .register_gauge(
            "active_connections".to_string(),
            "Number of active connections".to_string(),
        )
        .expect("Failed to register gauge");

    let histogram = registry
        .register_histogram(
            "request_duration_seconds".to_string(),
            "Request duration in seconds".to_string(),
            None,
        )
        .expect("Failed to register histogram");

    let summary = registry
        .register_summary(
            "response_size_bytes".to_string(),
            "Response size in bytes".to_string(),
        )
        .expect("Failed to register summary");

    let labels1 = vec![
        ("method".to_string(), "GET".to_string()),
        ("path".to_string(), "/api/users".to_string()),
    ];
    let labels2 = vec![
        ("method".to_string(), "POST".to_string()),
        ("path".to_string(), "/api/users".to_string()),
    ];

    counter.inc(&labels1);
    counter.inc(&labels1);
    counter.inc_by(&labels2, 5.0);

    gauge.set(&labels1, 42.0);
    gauge.inc(&labels1);
    gauge.dec_by(&labels2, 5.0);

    histogram.observe(&labels1, 0.05);
    histogram.observe(&labels1, 0.1);
    histogram.observe(&labels1, 0.5);
    histogram.observe(&labels2, 0.01);
    histogram.observe(&labels2, 1.5);

    summary.observe(&labels1, 1024.0);
    summary.observe(&labels1, 2048.0);
    summary.observe(&labels1, 4096.0);
    summary.observe(&labels2, 512.0);
    summary.observe(&labels2, 8192.0);

    let addr: SocketAddr = "0.0.0.0:8100".parse().expect("Invalid address");
    let server = MetricsServer::new(Arc::clone(&registry), addr)
        .with_expire_interval(10);

    log::info!("Example metrics registered. Try:");
    log::info!("  curl http://localhost:8080/metrics");
    log::info!("");
    log::info!("Example push command:");
    let push_example = r##"  curl -X POST http://localhost:8080/push \
    -H "Content-Type: application/json" \
    -d '{
      "name": "custom_metric",
      "metric_type": "Counter",
      "help": "A custom pushed metric",
      "labels": [["service", "payment"]],
      "value": 1.0,
      "instance": "node-1"
    }'"##;
    println!("{}", push_example);

    server.run().await;
}
