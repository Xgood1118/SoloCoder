use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

pub type Labels = Vec<(String, String)>;
pub type LabelsKey = Vec<(String, String)>;

pub fn labels_to_key(labels: &Labels) -> LabelsKey {
    let mut sorted = labels.clone();
    sorted.sort_by(|a, b| a.0.cmp(&b.0));
    sorted
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MetricType {
    Counter,
    Gauge,
    Histogram,
    Summary,
}

impl MetricType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MetricType::Counter => "counter",
            MetricType::Gauge => "gauge",
            MetricType::Histogram => "histogram",
            MetricType::Summary => "summary",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricMeta {
    pub name: String,
    pub metric_type: MetricType,
    pub help: String,
    pub high_cardinality_threshold: usize,
}

impl MetricMeta {
    pub fn new(name: String, metric_type: MetricType, help: String) -> Self {
        Self {
            name,
            metric_type,
            help,
            high_cardinality_threshold: 100,
        }
    }
}

#[derive(Debug)]
pub struct CounterMetric {
    pub meta: Arc<MetricMeta>,
    pub values: Mutex<HashMap<LabelsKey, f64>>,
}

impl CounterMetric {
    pub fn new(meta: Arc<MetricMeta>) -> Self {
        Self {
            meta,
            values: Mutex::new(HashMap::new()),
        }
    }

    pub fn inc(&self, labels: &Labels) {
        self.inc_by(labels, 1.0);
    }

    pub fn inc_by(&self, labels: &Labels, value: f64) {
        if value < 0.0 {
            log::warn!("Counter cannot be decreased, ignoring negative value: {}", value);
            return;
        }
        let key = labels_to_key(labels);
        let mut values = self.values.lock();
        let entry = values.entry(key).or_insert(0.0);
        *entry += value;
    }

    pub fn get(&self, labels: &Labels) -> f64 {
        let key = labels_to_key(labels);
        self.values.lock().get(&key).copied().unwrap_or(0.0)
    }
}

#[derive(Debug)]
pub struct GaugeMetric {
    pub meta: Arc<MetricMeta>,
    pub values: Mutex<HashMap<LabelsKey, f64>>,
}

impl GaugeMetric {
    pub fn new(meta: Arc<MetricMeta>) -> Self {
        Self {
            meta,
            values: Mutex::new(HashMap::new()),
        }
    }

    pub fn set(&self, labels: &Labels, value: f64) {
        let key = labels_to_key(labels);
        self.values.lock().insert(key, value);
    }

    pub fn inc(&self, labels: &Labels) {
        self.inc_by(labels, 1.0);
    }

    pub fn inc_by(&self, labels: &Labels, value: f64) {
        let key = labels_to_key(labels);
        let mut values = self.values.lock();
        let entry = values.entry(key).or_insert(0.0);
        *entry += value;
    }

    pub fn dec(&self, labels: &Labels) {
        self.dec_by(labels, 1.0);
    }

    pub fn dec_by(&self, labels: &Labels, value: f64) {
        let key = labels_to_key(labels);
        let mut values = self.values.lock();
        let entry = values.entry(key).or_insert(0.0);
        *entry -= value;
    }

    pub fn get(&self, labels: &Labels) -> f64 {
        let key = labels_to_key(labels);
        self.values.lock().get(&key).copied().unwrap_or(0.0)
    }
}

#[derive(Debug, Clone)]
pub struct HistogramBucket {
    pub upper_bound: f64,
    pub count: u64,
}

#[derive(Debug)]
pub struct HistogramData {
    pub sum: f64,
    pub count: u64,
    pub buckets: Vec<HistogramBucket>,
}

impl HistogramData {
    fn new(buckets: &[f64]) -> Self {
        let mut sorted_buckets = buckets.to_vec();
        sorted_buckets.sort_by(|a, b| a.partial_cmp(b).unwrap());
        Self {
            sum: 0.0,
            count: 0,
            buckets: sorted_buckets
                .into_iter()
                .map(|upper| HistogramBucket {
                    upper_bound: upper,
                    count: 0,
                })
                .collect(),
        }
    }

    fn observe(&mut self, value: f64) {
        self.sum += value;
        self.count += 1;
        for bucket in &mut self.buckets {
            if value <= bucket.upper_bound {
                bucket.count += 1;
            }
        }
    }
}

#[derive(Debug)]
pub struct HistogramMetric {
    pub meta: Arc<MetricMeta>,
    pub buckets: Vec<f64>,
    pub values: Mutex<HashMap<LabelsKey, HistogramData>>,
}

impl HistogramMetric {
    pub fn new(meta: Arc<MetricMeta>, buckets: Vec<f64>) -> Self {
        Self {
            meta,
            buckets,
            values: Mutex::new(HashMap::new()),
        }
    }

    pub fn default_buckets() -> Vec<f64> {
        vec![
            0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
        ]
    }

    pub fn observe(&self, labels: &Labels, value: f64) {
        let key = labels_to_key(labels);
        let mut values = self.values.lock();
        let entry = values
            .entry(key)
            .or_insert_with(|| HistogramData::new(&self.buckets));
        entry.observe(value);
    }
}

#[derive(Debug)]
pub struct Quantile {
    pub quantile: f64,
    pub value: f64,
}

#[derive(Debug)]
pub struct SummaryData {
    pub sum: f64,
    pub count: u64,
    pub quantiles: Vec<Quantile>,
    hdr: hdrhistogram::Histogram<u64>,
}

impl SummaryData {
    fn new() -> Self {
        Self {
            sum: 0.0,
            count: 0,
            quantiles: vec![
                Quantile { quantile: 0.5, value: 0.0 },
                Quantile { quantile: 0.9, value: 0.0 },
                Quantile { quantile: 0.99, value: 0.0 },
            ],
            hdr: hdrhistogram::Histogram::<u64>::new_with_bounds(1, u64::MAX, 3)
                .expect("Failed to create HDR histogram"),
        }
    }

    fn observe(&mut self, value: f64) {
        self.sum += value;
        self.count += 1;
        let scaled = (value * 1_000_000.0) as u64;
        let _ = self.hdr.record(scaled);

        for q in &mut self.quantiles {
            let val = self.hdr.value_at_quantile(q.quantile) as f64 / 1_000_000.0;
            q.value = val;
        }
    }
}

#[derive(Debug)]
pub struct SummaryMetric {
    pub meta: Arc<MetricMeta>,
    pub values: Mutex<HashMap<LabelsKey, SummaryData>>,
}

impl SummaryMetric {
    pub fn new(meta: Arc<MetricMeta>) -> Self {
        Self {
            meta,
            values: Mutex::new(HashMap::new()),
        }
    }

    pub fn observe(&self, labels: &Labels, value: f64) {
        let key = labels_to_key(labels);
        let mut values = self.values.lock();
        let entry = values.entry(key).or_insert_with(SummaryData::new);
        entry.observe(value);
    }
}

#[derive(Debug, Clone)]
pub enum Metric {
    Counter(Arc<CounterMetric>),
    Gauge(Arc<GaugeMetric>),
    Histogram(Arc<HistogramMetric>),
    Summary(Arc<SummaryMetric>),
}

impl Metric {
    pub fn meta(&self) -> &Arc<MetricMeta> {
        match self {
            Metric::Counter(m) => &m.meta,
            Metric::Gauge(m) => &m.meta,
            Metric::Histogram(m) => &m.meta,
            Metric::Summary(m) => &m.meta,
        }
    }

    pub fn metric_type(&self) -> MetricType {
        self.meta().metric_type.clone()
    }

    pub fn cardinality(&self) -> usize {
        match self {
            Metric::Counter(m) => m.values.lock().len(),
            Metric::Gauge(m) => m.values.lock().len(),
            Metric::Histogram(m) => m.values.lock().len(),
            Metric::Summary(m) => m.values.lock().len(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushRequest {
    pub name: String,
    pub metric_type: MetricType,
    pub help: Option<String>,
    pub labels: Labels,
    pub value: f64,
    pub buckets: Option<Vec<f64>>,
    pub instance: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PushInfo {
    pub instance: String,
    pub last_push: chrono::DateTime<chrono::Utc>,
    pub expire_seconds: u64,
}
