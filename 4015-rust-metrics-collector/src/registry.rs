use crate::types::*;
use dashmap::DashMap;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub enum RegisterError {
    AlreadyExists,
    TypeMismatch,
}

pub struct MetricRegistry {
    metrics: DashMap<String, Metric>,
    push_instances: DashMap<String, PushInfo>,
    default_high_cardinality_threshold: usize,
}

impl MetricRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            metrics: DashMap::new(),
            push_instances: DashMap::new(),
            default_high_cardinality_threshold: 100,
        })
    }

    pub fn default_threshold(&self) -> usize {
        self.default_high_cardinality_threshold
    }

    pub fn register_counter(
        self: &Arc<Self>,
        name: String,
        help: String,
    ) -> Result<Arc<CounterMetric>, RegisterError> {
        if self.metrics.contains_key(&name) {
            return Err(RegisterError::AlreadyExists);
        }

        let mut meta = MetricMeta::new(name.clone(), MetricType::Counter, help);
        meta.high_cardinality_threshold = self.default_high_cardinality_threshold;
        let meta = Arc::new(meta);
        let counter = Arc::new(CounterMetric::new(meta));

        self.metrics
            .insert(name, Metric::Counter(counter.clone()));

        Ok(counter)
    }

    pub fn register_gauge(
        self: &Arc<Self>,
        name: String,
        help: String,
    ) -> Result<Arc<GaugeMetric>, RegisterError> {
        if self.metrics.contains_key(&name) {
            return Err(RegisterError::AlreadyExists);
        }

        let mut meta = MetricMeta::new(name.clone(), MetricType::Gauge, help);
        meta.high_cardinality_threshold = self.default_high_cardinality_threshold;
        let meta = Arc::new(meta);
        let gauge = Arc::new(GaugeMetric::new(meta));

        self.metrics.insert(name, Metric::Gauge(gauge.clone()));

        Ok(gauge)
    }

    pub fn register_histogram(
        self: &Arc<Self>,
        name: String,
        help: String,
        buckets: Option<Vec<f64>>,
    ) -> Result<Arc<HistogramMetric>, RegisterError> {
        if self.metrics.contains_key(&name) {
            return Err(RegisterError::AlreadyExists);
        }

        let mut meta = MetricMeta::new(name.clone(), MetricType::Histogram, help);
        meta.high_cardinality_threshold = self.default_high_cardinality_threshold;
        let meta = Arc::new(meta);
        let buckets = buckets.unwrap_or_else(HistogramMetric::default_buckets);
        let histogram = Arc::new(HistogramMetric::new(meta, buckets));

        self.metrics
            .insert(name, Metric::Histogram(histogram.clone()));

        Ok(histogram)
    }

    pub fn register_summary(
        self: &Arc<Self>,
        name: String,
        help: String,
    ) -> Result<Arc<SummaryMetric>, RegisterError> {
        if self.metrics.contains_key(&name) {
            return Err(RegisterError::AlreadyExists);
        }

        let mut meta = MetricMeta::new(name.clone(), MetricType::Summary, help);
        meta.high_cardinality_threshold = self.default_high_cardinality_threshold;
        let meta = Arc::new(meta);
        let summary = Arc::new(SummaryMetric::new(meta));

        self.metrics
            .insert(name, Metric::Summary(summary.clone()));

        Ok(summary)
    }

    pub fn get_or_create_counter(
        self: &Arc<Self>,
        name: String,
        help: String,
    ) -> Arc<CounterMetric> {
        if let Some(metric) = self.metrics.get(&name) {
            if let Metric::Counter(c) = metric.value() {
                return c.clone();
            }
        }

        match self.register_counter(name.clone(), help) {
            Ok(c) => c,
            Err(RegisterError::AlreadyExists) => {
                if let Some(metric) = self.metrics.get(&name) {
                    if let Metric::Counter(c) = metric.value() {
                        return c.clone();
                    }
                }
                panic!("Metric {} exists but is not a counter", name);
            }
            Err(RegisterError::TypeMismatch) => {
                panic!("Metric {} exists with different type", name);
            }
        }
    }

    pub fn get_or_create_gauge(
        self: &Arc<Self>,
        name: String,
        help: String,
    ) -> Arc<GaugeMetric> {
        if let Some(metric) = self.metrics.get(&name) {
            if let Metric::Gauge(g) = metric.value() {
                return g.clone();
            }
        }

        match self.register_gauge(name.clone(), help) {
            Ok(g) => g,
            Err(RegisterError::AlreadyExists) => {
                if let Some(metric) = self.metrics.get(&name) {
                    if let Metric::Gauge(g) = metric.value() {
                        return g.clone();
                    }
                }
                panic!("Metric {} exists but is not a gauge", name);
            }
            Err(RegisterError::TypeMismatch) => {
                panic!("Metric {} exists with different type", name);
            }
        }
    }

    pub fn get_or_create_histogram(
        self: &Arc<Self>,
        name: String,
        help: String,
        buckets: Option<Vec<f64>>,
    ) -> Arc<HistogramMetric> {
        if let Some(metric) = self.metrics.get(&name) {
            if let Metric::Histogram(h) = metric.value() {
                return h.clone();
            }
        }

        match self.register_histogram(name.clone(), help, buckets) {
            Ok(h) => h,
            Err(RegisterError::AlreadyExists) => {
                if let Some(metric) = self.metrics.get(&name) {
                    if let Metric::Histogram(h) = metric.value() {
                        return h.clone();
                    }
                }
                panic!("Metric {} exists but is not a histogram", name);
            }
            Err(RegisterError::TypeMismatch) => {
                panic!("Metric {} exists with different type", name);
            }
        }
    }

    pub fn get_or_create_summary(
        self: &Arc<Self>,
        name: String,
        help: String,
    ) -> Arc<SummaryMetric> {
        if let Some(metric) = self.metrics.get(&name) {
            if let Metric::Summary(s) = metric.value() {
                return s.clone();
            }
        }

        match self.register_summary(name.clone(), help) {
            Ok(s) => s,
            Err(RegisterError::AlreadyExists) => {
                if let Some(metric) = self.metrics.get(&name) {
                    if let Metric::Summary(s) = metric.value() {
                        return s.clone();
                    }
                }
                panic!("Metric {} exists but is not a summary", name);
            }
            Err(RegisterError::TypeMismatch) => {
                panic!("Metric {} exists with different type", name);
            }
        }
    }

    pub fn get_metric(&self, name: &str) -> Option<Metric> {
        self.metrics.get(name).map(|m| (*m).clone())
    }

    pub fn list_metrics(&self) -> Vec<Metric> {
        self.metrics.iter().map(|m| (*m).clone()).collect()
    }

    pub fn check_high_cardinality(&self) -> Vec<(String, usize, usize)> {
        let mut warnings = Vec::new();
        for entry in self.metrics.iter() {
            let metric = entry.value();
            let cardinality = metric.cardinality();
            let threshold = metric.meta().high_cardinality_threshold;
            if cardinality > threshold {
                warnings.push((entry.key().clone(), cardinality, threshold));
            }
        }
        warnings
    }

    pub fn record_push(&self, instance: String, expire_seconds: u64) {
        self.push_instances.insert(
            instance.clone(),
            PushInfo {
                instance,
                last_push: chrono::Utc::now(),
                expire_seconds,
            },
        );
    }

    pub fn cleanup_expired_instances(&self) -> Vec<String> {
        let now = chrono::Utc::now();
        let mut expired = Vec::new();

        self.push_instances.retain(|instance, info| {
            let elapsed = now.signed_duration_since(info.last_push);
            if elapsed.num_seconds() > info.expire_seconds as i64 {
                expired.push(instance.clone());
                false
            } else {
                true
            }
        });

        for instance in &expired {
            self.metrics.retain(|_, metric| {
                let labels_to_remove: Vec<LabelsKey> = match metric {
                    Metric::Counter(m) => {
                        let values = m.values.lock();
                        values
                            .iter()
                            .filter(|(k, _)| {
                                k.iter().any(|(key, val)| key == "instance" && val == instance)
                            })
                            .map(|(k, _)| k.clone())
                            .collect()
                    }
                    Metric::Gauge(m) => {
                        let values = m.values.lock();
                        values
                            .iter()
                            .filter(|(k, _)| {
                                k.iter().any(|(key, val)| key == "instance" && val == instance)
                            })
                            .map(|(k, _)| k.clone())
                            .collect()
                    }
                    Metric::Histogram(m) => {
                        let values = m.values.lock();
                        values
                            .iter()
                            .filter(|(k, _)| {
                                k.iter().any(|(key, val)| key == "instance" && val == instance)
                            })
                            .map(|(k, _)| k.clone())
                            .collect()
                    }
                    Metric::Summary(m) => {
                        let values = m.values.lock();
                        values
                            .iter()
                            .filter(|(k, _)| {
                                k.iter().any(|(key, val)| key == "instance" && val == instance)
                            })
                            .map(|(k, _)| k.clone())
                            .collect()
                    }
                };

                match metric {
                    Metric::Counter(m) => {
                        let mut values = m.values.lock();
                        for k in labels_to_remove {
                            values.remove(&k);
                        }
                    }
                    Metric::Gauge(m) => {
                        let mut values = m.values.lock();
                        for k in labels_to_remove {
                            values.remove(&k);
                        }
                    }
                    Metric::Histogram(m) => {
                        let mut values = m.values.lock();
                        for k in labels_to_remove {
                            values.remove(&k);
                        }
                    }
                    Metric::Summary(m) => {
                        let mut values = m.values.lock();
                        for k in labels_to_remove {
                            values.remove(&k);
                        }
                    }
                }

                true
            });
        }

        expired
    }

    pub fn remove_metric(&self, name: &str) -> Option<Metric> {
        self.metrics.remove(name).map(|(_, v)| v)
    }
}
