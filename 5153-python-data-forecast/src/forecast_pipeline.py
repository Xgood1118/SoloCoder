import pandas as pd
import numpy as np
from typing import List, Dict, Optional, Tuple
from .data_preprocessing import DataPreprocessor
from .seasonal_decomposition import SeasonalDecomposer
from .time_series_models import (
    ARIMAModel,
    SARIMAModel,
    ExponentialSmoothingModel,
    ProphetModel
)
from .auto_arima import AutoARIMA
from .model_comparison import ModelComparator
from .visualization import ForecastVisualizer
from .distribution_fitting import DistributionFitter


class ForecastPipeline:
    def __init__(
        self,
        use_seasonal_adjustment: bool = True,
        confidence_level: float = 0.95,
        preprocessor: Optional[DataPreprocessor] = None,
        decomposer: Optional[SeasonalDecomposer] = None,
        visualizer: Optional[ForecastVisualizer] = None
    ):
        self.use_seasonal_adjustment = use_seasonal_adjustment
        self.confidence_level = confidence_level
        self.alpha = 1 - confidence_level
        self.preprocessor = preprocessor or DataPreprocessor()
        self.decomposer = decomposer or SeasonalDecomposer()
        self.visualizer = visualizer or ForecastVisualizer()
        self.comparator = ModelComparator()
        self.data = None
        self.processed_data = None
        self.preprocess_info = None
        self.value_col = None
        self.deseasonalized_data = None
        self.fitted = False

    def load_data(
        self,
        file_path: str,
        time_col: Optional[str] = None,
        value_col: Optional[str] = None
    ) -> 'ForecastPipeline':
        print("正在加载和预处理数据...")
        df = pd.read_csv(file_path)
        self.processed_data, self.preprocess_info = self.preprocessor.preprocess(df, time_col, value_col)
        self.value_col = self.preprocess_info['value_column']
        self.data = self.processed_data.copy()

        print(f"数据预处理完成:")
        print(f"  - 时间列: {self.preprocess_info['time_column']}")
        print(f"  - 数值列: {self.preprocess_info['value_column']}")
        print(f"  - 数据频率: {self.preprocess_info['frequency']}")
        print(f"  - 异常值数量: {self.preprocess_info['outliers_count']}")

        if self.use_seasonal_adjustment:
            print("\n正在进行季节性分解...")
            self.decomposer.decompose(self.processed_data, self.value_col)
            self.deseasonalized_data = pd.DataFrame({
                self.value_col: self.decomposer.remove_seasonality(self.processed_data, self.value_col)
            })
            print("季节性分解完成")

        return self

    def set_models(self, models: List[Tuple[str, object]]) -> 'ForecastPipeline':
        self.comparator = ModelComparator()
        for name, model in models:
            self.comparator.add_model(model, name)
        return self

    def set_default_models(self, seasonal_periods: int = 12) -> 'ForecastPipeline':
        models = [
            ('ARIMA', ARIMAModel(order=(1, 1, 1))),
            ('SARIMA', SARIMAModel(order=(1, 1, 1), seasonal_order=(1, 1, 1, seasonal_periods))),
            ('ETS', ExponentialSmoothingModel(seasonal_periods=seasonal_periods)),
            ('Prophet', ProphetModel()),
        ]
        return self.set_models(models)

    def fit(self, verbose: bool = True) -> 'ForecastPipeline':
        if self.processed_data is None:
            raise ValueError("请先加载数据")

        print("\n正在训练所有模型...")

        if self.use_seasonal_adjustment and self.deseasonalized_data is not None:
            fit_data = self.deseasonalized_data
        else:
            fit_data = self.processed_data

        self.comparator.fit_all(fit_data, self.value_col, verbose=verbose)
        self.fitted = True

        if verbose:
            print("\n模型性能对比:")
            print(self.comparator.get_comparison_table())

        return self

    def forecast(
        self,
        steps: int,
        return_best_only: bool = False,
        metric: str = 'RMSE'
    ) -> pd.DataFrame:
        if not self.fitted:
            raise ValueError("请先训练模型")

        print(f"\n正在预测未来 {steps} 个时间点...")
        predictions = self.comparator.predict_all(steps=steps, alpha=self.alpha)

        if self.use_seasonal_adjustment:
            predictions = self._adjust_predictions(predictions)

        if return_best_only:
            best_name, _, _ = self.comparator.get_best_model()
            cols = [col for col in predictions.columns if best_name in col]
            predictions = predictions[cols]

        return predictions

    def _adjust_predictions(self, predictions: pd.DataFrame) -> pd.DataFrame:
        adjusted = predictions.copy()

        for col in predictions.columns:
            if 'forecast' in col:
                model_name = col.replace('_forecast', '')
                forecast_series = predictions[col]
                adjusted_forecast = self.decomposer.adjust_forecast(
                    forecast_series,
                    predictions.index
                )
                adjusted[col] = adjusted_forecast.values

                lower_col = f"{model_name}_lower"
                upper_col = f"{model_name}_upper"

                if lower_col in predictions.columns:
                    lower_series = predictions[lower_col]
                    upper_series = predictions[upper_col]
                    adj_lower, adj_upper = self.decomposer.adjust_confidence_interval(
                        lower_series,
                        upper_series,
                        predictions.index
                    )
                    adjusted[lower_col] = adj_lower.values
                    adjusted[upper_col] = adj_upper.values

        return adjusted

    def get_best_model(self, metric: str = 'RMSE') -> Tuple[str, object, Dict]:
        return self.comparator.get_best_model()

    def plot_forecast(
        self,
        steps: int,
        show_ci: bool = True,
        save_path: Optional[str] = None
    ):
        predictions = self.forecast(steps=steps)
        history = self.processed_data[self.value_col]

        fig = self.visualizer.plot_forecast(
            history,
            predictions,
            show_confidence_interval=show_ci
        )

        if save_path:
            self.visualizer.save_figure(fig, save_path)

        return fig

    def plot_decomposition(self, save_path: Optional[str] = None):
        if not self.use_seasonal_adjustment:
            raise ValueError("未启用季节性调整")

        components = self.decomposer.get_components()
        fig = self.visualizer.plot_seasonal_decomposition(components)

        if save_path:
            self.visualizer.save_figure(fig, save_path)

        return fig

    def plot_model_comparison(self, save_path: Optional[str] = None):
        metrics_df = self.comparator.get_comparison_table()
        fig = self.visualizer.plot_model_comparison(metrics_df)

        if save_path:
            self.visualizer.save_figure(fig, save_path)

        return fig

    def plot_residuals(self, model_name: str, save_path: Optional[str] = None):
        if model_name not in self.comparator.fitted_models:
            raise ValueError(f"模型 {model_name} 不存在")

        model = self.comparator.fitted_models[model_name]
        residuals = model.get_residuals()
        fig = self.visualizer.plot_residuals(residuals, title=f'{model_name} 残差分析')

        if save_path:
            self.visualizer.save_figure(fig, save_path)

        return fig

    def export_results(
        self,
        steps: int,
        file_path: str,
        format: str = 'csv',
        best_model_only: bool = False
    ):
        if format == 'csv':
            self.comparator.export_forecast_to_csv(file_path, steps, self.alpha, best_model_only)
        elif format == 'excel':
            self.comparator.export_forecast_to_excel(file_path, steps, self.alpha)
        else:
            raise ValueError(f"不支持的格式: {format}")

    def run_pipeline(
        self,
        file_path: str,
        steps: int,
        time_col: Optional[str] = None,
        value_col: Optional[str] = None,
        export_path: Optional[str] = None
    ) -> Dict:
        self.load_data(file_path, time_col, value_col)
        self.set_default_models()
        self.fit()
        predictions = self.forecast(steps=steps)
        best_name, best_model, best_metrics = self.get_best_model()

        results = {
            'predictions': predictions,
            'best_model_name': best_name,
            'best_model': best_model,
            'best_metrics': best_metrics,
            'all_metrics': self.comparator.metrics,
            'preprocess_info': self.preprocess_info
        }

        if export_path:
            self.export_results(steps, export_path)

        return results
