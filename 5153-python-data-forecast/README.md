# 时间序列预测工具

一个功能强大的 Python 时间序列预测工具，支持多模型对比、置信区间计算、季节性调整和分布拟合。

## 功能特性

### 1. 时间序列预测
- 支持多种时间序列模型：ARIMA、SARIMA、指数平滑（ETS）、Prophet
- 自动识别时间戳列和数值列
- 自动检测数据频率（分钟级、小时级、天级、周级、月级）
- 可配置的预测时间范围

### 2. 数据预处理
- **缺失值处理**：前向填充、后向填充、线性插值、均值、中位数、时间插值
- **异常值检测**：IQR 方法、Z-score 方法、百分位数方法
- **异常值处理**：剔除、替换、保留

### 3. 多模型对比
- 同时运行多个预测模型
- 计算历史拟合误差（MAE、RMSE、MAPE）
- 支持按预测误差排序
- 自动选择最优模型

### 4. 置信区间
- 支持 90%、95%、99% 置信度（可配置）
- 多种计算方法：正态分布、t分布、自助法、残差分位数
- 置信区间宽度随预测时间增加而扩大
- 带状区域可视化

### 5. statsmodels 集成
- ARIMA、SARIMAX、ExponentialSmoothing 模型
- 自动推断季节性参数
- 模型摘要信息展示
- Pickle 格式保存和加载

### 6. pmdarima 集成
- 自动选择最优 ARIMA 阶数 (p,d,q) 和 (P,D,Q,m)
- 进度条显示搜索过程
- 统一的模型保存格式

### 7. 季节性调整
- STL 和经典分解方法
- 加法模型和乘法模型
- 趋势、季节、残差成分分解
- 预测结果季节性还原

### 8. scipy 分布拟合
- 支持多种概率分布：正态、对数正态、指数、Weibull、Gamma、Beta、均匀
- 最大似然估计参数
- KS 检验和 AIC/BIC 模型选择
- 蒙特卡洛模拟

### 9. 结果可视化
- 历史数据与预测值对比图
- 置信区间带状显示
- 季节性分解图表
- 模型性能对比图
- 残差分析图
- 导出为图片格式

### 10. 结果导出
- CSV 格式导出
- Excel 格式导出

## 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 基本使用

```python
from src.forecast_pipeline import ForecastPipeline

# 创建预测管道
pipeline = ForecastPipeline(
    use_seasonal_adjustment=True,
    confidence_level=0.95
)

# 运行完整预测流程
results = pipeline.run_pipeline(
    file_path='your_data.csv',
    steps=12,  # 预测未来12个时间点
    export_path='forecast_results.csv'
)

# 查看结果
print(f"最优模型: {results['best_model_name']}")
print(f"预测结果:\n{results['predictions']}")
```

### 自定义模型组合

```python
from src.forecast_pipeline import ForecastPipeline
from src.time_series_models import ARIMAModel, SARIMAModel, ExponentialSmoothingModel

pipeline = ForecastPipeline()

# 加载数据
pipeline.load_data('your_data.csv')

# 自定义模型
models = [
    ('ARIMA(2,1,1)', ARIMAModel(order=(2, 1, 1))),
    ('SARIMA', SARIMAModel(order=(1,1,1), seasonal_order=(1,1,1,12))),
    ('ETS', ExponentialSmoothingModel(seasonal_periods=12)),
]
pipeline.set_models(models)

# 训练和预测
pipeline.fit()
predictions = pipeline.forecast(steps=12)
```

### 使用 pmdarima 自动选择参数

```python
from src.auto_arima import AutoARIMA
from src.data_preprocessing import DataPreprocessor
import pandas as pd

# 预处理数据
preprocessor = DataPreprocessor()
df = pd.read_csv('your_data.csv')
processed_data, info = preprocessor.preprocess(df)

# 自动选择 ARIMA 参数
auto_arima = AutoARIMA(
    seasonal=True,
    seasonal_periods=12,
    max_p=5,
    max_q=5
)
auto_arima.fit(processed_data, info['value_column'])

# 查看最优参数
print(auto_arima.get_best_params())

# 预测
predictions = auto_arima.predict(steps=12)
```

### 分布拟合和蒙特卡洛模拟

```python
from src.distribution_fitting import DistributionFitter, DistributionType
import numpy as np

# 生成示例数据
data = np.random.normal(loc=50, scale=10, size=1000)

# 拟合多种分布
fitter = DistributionFitter()
results = fitter.fit_all(data)
print(results)

# 蒙特卡洛模拟
paths = fitter.monte_carlo_simulation(
    distribution_name='normal',
    n_simulations=10000,
    n_steps=50,
    initial_value=100
)

# 获取分位数
percentiles = fitter.get_percentiles(paths, [5, 50, 95])
```

### 可视化

```python
from src.forecast_pipeline import ForecastPipeline

pipeline = ForecastPipeline()
pipeline.load_data('your_data.csv')
pipeline.set_default_models()
pipeline.fit()

# 预测图
fig1 = pipeline.plot_forecast(steps=12)
fig1.savefig('forecast.png', dpi=300)

# 模型对比图
fig2 = pipeline.plot_model_comparison()
fig2.savefig('comparison.png', dpi=300)

# 季节性分解图
fig3 = pipeline.plot_decomposition()
fig3.savefig('decomposition.png', dpi=300)
```

## 项目结构

```
5153-python-data-forecast/
├── src/
│   ├── __init__.py              # 包初始化
│   ├── data_preprocessing.py    # 数据预处理模块
│   ├── time_series_models.py    # 时间序列模型封装
│   ├── auto_arima.py            # pmdarima 自动参数选择
│   ├── seasonal_decomposition.py # 季节性分解模块
│   ├── confidence_interval.py   # 置信区间计算模块
│   ├── model_comparison.py      # 多模型对比模块
│   ├── visualization.py         # 可视化模块
│   ├── distribution_fitting.py  # 分布拟合和蒙特卡洛模拟
│   └── forecast_pipeline.py     # 预测管道（整合所有功能）
├── requirements.txt             # 依赖列表
├── example.py                   # 示例代码
└── README.md                    # 项目文档
```

## 模块说明

### data_preprocessing.py
- `DataPreprocessor`: 数据预处理类
- `MissingValueMethod`: 缺失值处理方法枚举
- `OutlierMethod`: 异常值检测方法枚举
- `OutlierHandling`: 异常值处理策略枚举

### time_series_models.py
- `BaseTimeSeriesModel`: 模型基类
- `ARIMAModel`: ARIMA 模型
- `SARIMAModel`: SARIMA 模型
- `ExponentialSmoothingModel`: 指数平滑模型
- `ProphetModel`: Facebook Prophet 模型

### auto_arima.py
- `AutoARIMA`: 自动 ARIMA 参数选择类

### seasonal_decomposition.py
- `SeasonalDecomposer`: 季节性分解类
- `DecompositionMethod`: 分解方法（加法/乘法）
- `DecompositionType`: 分解类型（经典/STL）

### confidence_interval.py
- `ConfidenceIntervalCalculator`: 置信区间计算器
- `ConfidenceLevel`: 置信水平枚举
- `ConfidenceIntervalMethod`: 计算方法枚举

### model_comparison.py
- `ModelComparator`: 模型对比类
- `SortMetric`: 排序指标枚举

### visualization.py
- `ForecastVisualizer`: 可视化类

### distribution_fitting.py
- `DistributionFitter`: 分布拟合类
- `DistributionType`: 分布类型枚举

### forecast_pipeline.py
- `ForecastPipeline`: 预测管道（整合所有功能）

## 数据格式要求

输入 CSV 文件应包含至少两列：
- 时间戳列（例如：date, timestamp, datetime）
- 数值列（例如：value, sales, temperature）

示例数据格式：
```csv
date,value
2020-01-01,100.5
2020-02-01,110.2
2020-03-01,105.8
...
```

## 技术要点

### 模型兼容性
- statsmodels 和 pmdarima 的模型保存格式统一处理
- 统一的置信区间计算基准

### 季节性处理
- 支持单季节周期和多季节周期检测
- 预测结果自动还原季节性成分

### 异常值处理
- 异常值检测置信区间与预测置信区间独立计算
- 支持多种处理策略

## 运行示例

```bash
python example.py
```

这将运行所有示例功能，包括：
1. 基本时间序列预测
2. pmdarima 自动参数选择
3. scipy 分布拟合和蒙特卡洛模拟
4. 结果可视化
5. 结果导出

## 许可证

MIT License
