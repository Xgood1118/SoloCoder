use crate::prometheus::PrometheusFormatter;
use crate::registry::MetricRegistry;
use crate::types::*;
use serde::Deserialize;
use std::sync::Arc;
use warp::{Filter, Rejection, Reply};
use std::net::SocketAddr;

#[derive(Debug, Deserialize)]
struct PushQueryParams {
    expire: Option<u64>,
}

async fn handle_metrics(
    registry: Arc<MetricRegistry>,
    formatter: Arc<PrometheusFormatter>,
) -> Result<impl Reply, Rejection> {
    log::debug!("Handling /metrics request");
    let output = formatter.format(&registry);
    Ok(warp::reply::with_header(
        output,
        "Content-Type",
        "text/plain; version=0.0.4; charset=utf-8",
    ))
}

async fn handle_push(
    registry: Arc<MetricRegistry>,
    params: PushQueryParams,
    req: PushRequest,
) -> Result<impl Reply, Rejection> {
    let expire_seconds = params.expire.unwrap_or(30);
    log::debug!(
        "Handling /push request for metric '{}' from instance '{}', expire: {}s",
        req.name,
        req.instance,
        expire_seconds
    );

    let mut labels = req.labels.clone();
    labels.push(("instance".to_string(), req.instance.clone()));

    let help = req.help.clone().unwrap_or_else(|| req.name.clone());

    match req.metric_type {
        MetricType::Counter => {
            let counter = registry.get_or_create_counter(req.name.clone(), help);
            if req.value >= 0.0 {
                counter.inc_by(&labels, req.value);
            } else {
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({
                        "error": "Counter value must be non-negative"
                    })),
                    warp::http::StatusCode::BAD_REQUEST,
                ));
            }
        }
        MetricType::Gauge => {
            let gauge = registry.get_or_create_gauge(req.name.clone(), help);
            gauge.set(&labels, req.value);
        }
        MetricType::Histogram => {
            let histogram = registry.get_or_create_histogram(req.name.clone(), help, req.buckets);
            histogram.observe(&labels, req.value);
        }
        MetricType::Summary => {
            let summary = registry.get_or_create_summary(req.name.clone(), help);
            summary.observe(&labels, req.value);
        }
    }

    registry.record_push(req.instance.clone(), expire_seconds);

    Ok(warp::reply::with_status(
        warp::reply::json(&serde_json::json!({
            "status": "ok",
            "metric": req.name,
            "instance": req.instance,
            "expire_seconds": expire_seconds
        })),
        warp::http::StatusCode::OK,
    ))
}

async fn handle_health() -> Result<impl Reply, Rejection> {
    Ok(warp::reply::json(&serde_json::json!({ "status": "healthy" })))
}

pub struct MetricsServer {
    registry: Arc<MetricRegistry>,
    formatter: Arc<PrometheusFormatter>,
    addr: SocketAddr,
    expire_interval_seconds: u64,
}

impl MetricsServer {
    pub fn new(registry: Arc<MetricRegistry>, addr: SocketAddr) -> Self {
        Self {
            registry,
            formatter: Arc::new(PrometheusFormatter::new()),
            addr,
            expire_interval_seconds: 10,
        }
    }

    pub fn with_expire_interval(mut self, interval_seconds: u64) -> Self {
        self.expire_interval_seconds = interval_seconds;
        self
    }

    fn with_registry(
        registry: Arc<MetricRegistry>,
    ) -> impl Filter<Extract = (Arc<MetricRegistry>,), Error = std::convert::Infallible> + Clone {
        warp::any().map(move || registry.clone())
    }

    fn with_formatter(
        formatter: Arc<PrometheusFormatter>,
    ) -> impl Filter<Extract = (Arc<PrometheusFormatter>,), Error = std::convert::Infallible> + Clone {
        warp::any().map(move || formatter.clone())
    }

    pub async fn run(self) {
        let registry = self.registry.clone();
        let formatter = self.formatter.clone();
        let addr = self.addr;

        let metrics_route = warp::path("metrics")
            .and(warp::get())
            .and(Self::with_registry(registry.clone()))
            .and(Self::with_formatter(formatter.clone()))
            .and_then(handle_metrics);

        let push_route = warp::path("push")
            .and(warp::post())
            .and(Self::with_registry(registry.clone()))
            .and(warp::query::<PushQueryParams>())
            .and(warp::body::json())
            .and_then(handle_push);

        let health_route = warp::path("health")
            .and(warp::get())
            .and_then(handle_health);

        let routes = metrics_route.or(push_route).or(health_route);

        let registry_clone = registry.clone();
        let expire_interval = self.expire_interval_seconds;

        let cleanup_task = tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(tokio::time::Duration::from_secs(expire_interval));
            loop {
                interval.tick().await;
                let expired = registry_clone.cleanup_expired_instances();
                if !expired.is_empty() {
                    log::info!("Cleaned up {} expired instances: {:?}", expired.len(), expired);
                }

                let high_card = registry_clone.check_high_cardinality();
                for (name, cardinality, threshold) in &high_card {
                    log::warn!(
                        "HIGH CARDINALITY ALERT: metric '{}' has {} label combinations (threshold {})",
                        name, cardinality, threshold
                    );
                }
            }
        });

        log::info!("Starting metrics server on http://{}", addr);
        log::info!("  GET  /metrics - Pull metrics in Prometheus format");
        log::info!("  POST /push    - Push metrics (with ?expire= seconds)");
        log::info!("  GET  /health  - Health check");

        let server_task = warp::serve(routes).bind(addr);

        tokio::select! {
            _ = server_task => {},
            _ = cleanup_task => {},
        }
    }
}
