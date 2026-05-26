use crate::types::*;
use crate::registry::MetricRegistry;

fn format_value(value: f64) -> String {
    if value.is_nan() {
        "NaN".to_string()
    } else if value.is_infinite() {
        if value.is_sign_positive() {
            "+Inf".to_string()
        } else {
            "-Inf".to_string()
        }
    } else if value.fract() == 0.0 {
        format!("{:.0}", value)
    } else {
        format!("{}", value)
    }
}

fn format_labels(labels: &LabelsKey) -> String {
    if labels.is_empty() {
        String::new()
    } else {
        let parts: Vec<String> = labels
            .iter()
            .map(|(k, v)| format!("{}=\"{}\"", k, escape_label_value(v)))
            .collect();
        format!("{{{}}}", parts.join(","))
    }
}

fn escape_label_value(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

pub fn format_metric(metric: &Metric) -> String {
    let meta = metric.meta();
    let mut output = String::new();

    output.push_str(&format!("# HELP {} {}\n", meta.name, meta.help));
    output.push_str(&format!(
        "# TYPE {} {}\n",
        meta.name,
        meta.metric_type.as_str()
    ));

    match metric {
        Metric::Counter(c) => {
            let values = c.values.lock();
            for (labels, value) in values.iter() {
                output.push_str(&format!(
                    "{}{} {}\n",
                    meta.name,
                    format_labels(labels),
                    format_value(*value)
                ));
            }
        }
        Metric::Gauge(g) => {
            let values = g.values.lock();
            for (labels, value) in values.iter() {
                output.push_str(&format!(
                    "{}{} {}\n",
                    meta.name,
                    format_labels(labels),
                    format_value(*value)
                ));
            }
        }
        Metric::Histogram(h) => {
            let values = h.values.lock();
            for (labels, data) in values.iter() {
                for bucket in &data.buckets {
                    let mut bucket_labels = labels.clone();
                    let le = if bucket.upper_bound.is_infinite() {
                        "+Inf".to_string()
                    } else {
                        format_value(bucket.upper_bound)
                    };
                    bucket_labels.push(("le".to_string(), le));
                    output.push_str(&format!(
                        "{}_bucket{} {}\n",
                        meta.name,
                        format_labels(&bucket_labels),
                        bucket.count
                    ));
                }
                output.push_str(&format!(
                    "{}_sum{} {}\n",
                    meta.name,
                    format_labels(labels),
                    format_value(data.sum)
                ));
                output.push_str(&format!(
                    "{}_count{} {}\n",
                    meta.name,
                    format_labels(labels),
                    data.count
                ));
            }
        }
        Metric::Summary(s) => {
            let values = s.values.lock();
            for (labels, data) in values.iter() {
                for q in &data.quantiles {
                    let mut q_labels = labels.clone();
                    q_labels.push(("quantile".to_string(), format!("{}", q.quantile)));
                    output.push_str(&format!(
                        "{}{} {}\n",
                        meta.name,
                        format_labels(&q_labels),
                        format_value(q.value)
                    ));
                }
                output.push_str(&format!(
                    "{}_sum{} {}\n",
                    meta.name,
                    format_labels(labels),
                    format_value(data.sum)
                ));
                output.push_str(&format!(
                    "{}_count{} {}\n",
                    meta.name,
                    format_labels(labels),
                    data.count
                ));
            }
        }
    }

    output
}

pub fn format_registry(registry: &MetricRegistry) -> String {
    let mut output = String::new();

    let warnings = registry.check_high_cardinality();
    for (name, cardinality, threshold) in &warnings {
        log::warn!(
            "High cardinality alert: metric '{}' has {} label combinations (threshold {})",
            name,
            cardinality,
            threshold
        );
    }

    for metric in registry.list_metrics() {
        output.push_str(&format_metric(&metric));
    }

    output
}

pub struct PrometheusFormatter;

impl PrometheusFormatter {
    pub fn new() -> Self {
        Self
    }

    pub fn format(&self, registry: &MetricRegistry) -> String {
        format_registry(registry)
    }
}
