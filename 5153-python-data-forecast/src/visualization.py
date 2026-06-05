import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Optional, List, Dict
from matplotlib.figure import Figure
import warnings
warnings.filterwarnings('ignore')


class ForecastVisualizer:
    def __init__(self, style: str = 'seaborn-v0_8', figsize: tuple = (12, 8)):
        plt.style.use(style)
        self.figsize = figsize
        self.colors = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
            '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'
        ]

    def plot_forecast(
        self,
        history: pd.Series,
        forecast_df: pd.DataFrame,
        model_names: Optional[List[str]] = None,
        show_confidence_interval: bool = True,
        title: str = '时间序列预测',
        xlabel: str = '日期',
        ylabel: str = '数值'
    ) -> Figure:
        fig, ax = plt.subplots(figsize=self.figsize)

        ax.plot(history.index, history.values, label='历史数据', color='black', linewidth=2)

        if model_names is None:
            forecast_cols = [c for c in forecast_df.columns if 'forecast' in c.lower()]
            model_names = [c.replace('_forecast', '') for c in forecast_cols]

        for i, model_name in enumerate(model_names):
            forecast_col = f"{model_name}_forecast"
            lower_col = f"{model_name}_lower"
            upper_col = f"{model_name}_upper"

            if forecast_col in forecast_df.columns:
                color = self.colors[i % len(self.colors)]
                ax.plot(
                    forecast_df.index,
                    forecast_df[forecast_col],
                    label=f'{model_name} 预测',
                    color=color,
                    linewidth=2,
                    linestyle='--'
                )

                if show_confidence_interval and lower_col in forecast_df.columns:
                    ax.fill_between(
                        forecast_df.index,
                        forecast_df[lower_col],
                        forecast_df[upper_col],
                        color=color,
                        alpha=0.2,
                        label=f'{model_name} 置信区间'
                    )

        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel(xlabel, fontsize=12)
        ax.set_ylabel(ylabel, fontsize=12)
        ax.legend(loc='best')
        ax.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()

        return fig

    def plot_seasonal_decomposition(
        self,
        components: pd.DataFrame,
        title: str = '季节性分解'
    ) -> Figure:
        fig, axes = plt.subplots(4, 1, figsize=(self.figsize[0], 12), sharex=True)

        axes[0].plot(components.index, components['observed'], color='black', linewidth=1.5)
        axes[0].set_title('观测值', fontsize=12, fontweight='bold')
        axes[0].grid(True, alpha=0.3)

        axes[1].plot(components.index, components['trend'], color='#1f77b4', linewidth=1.5)
        axes[1].set_title('趋势成分', fontsize=12, fontweight='bold')
        axes[1].grid(True, alpha=0.3)

        axes[2].plot(components.index, components['seasonal'], color='#2ca02c', linewidth=1.5)
        axes[2].set_title('季节成分', fontsize=12, fontweight='bold')
        axes[2].grid(True, alpha=0.3)

        axes[3].plot(components.index, components['residual'], color='#ff7f0e', linewidth=1.5)
        axes[3].set_title('残差成分', fontsize=12, fontweight='bold')
        axes[3].grid(True, alpha=0.3)

        fig.suptitle(title, fontsize=14, fontweight='bold')
        plt.tight_layout()

        return fig

    def plot_model_comparison(
        self,
        metrics_df: pd.DataFrame,
        title: str = '模型性能对比'
    ) -> Figure:
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))

        metrics = ['MAE', 'RMSE', 'MAPE']
        for i, metric in enumerate(metrics):
            if metric in metrics_df.columns:
                data = metrics_df.sort_values(by=metric)
                axes[i].barh(data.index, data[metric], color=self.colors[:len(data)])
                axes[i].set_title(f'{metric} 对比', fontsize=12, fontweight='bold')
                axes[i].set_xlabel(metric)
                axes[i].grid(True, alpha=0.3, axis='x')

        fig.suptitle(title, fontsize=14, fontweight='bold')
        plt.tight_layout()

        return fig

    def plot_residuals(
        self,
        residuals: pd.Series,
        title: str = '残差分析',
        bins: int = 30
    ) -> Figure:
        fig, axes = plt.subplots(2, 2, figsize=self.figsize)

        axes[0, 0].plot(residuals.index, residuals.values, color='#1f77b4', linewidth=1)
        axes[0, 0].axhline(y=0, color='red', linestyle='--', linewidth=1)
        axes[0, 0].set_title('残差时序图', fontsize=12, fontweight='bold')
        axes[0, 0].grid(True, alpha=0.3)
        plt.setp(axes[0, 0].xaxis.get_majorticklabels(), rotation=45)

        axes[0, 1].hist(residuals.dropna(), bins=bins, color='#2ca02c', alpha=0.7, edgecolor='black')
        axes[0, 1].set_title('残差直方图', fontsize=12, fontweight='bold')
        axes[0, 1].set_xlabel('残差值')
        axes[0, 1].set_ylabel('频数')
        axes[0, 1].grid(True, alpha=0.3)

        from scipy import stats
        stats.probplot(residuals.dropna(), dist="norm", plot=axes[1, 0])
        axes[1, 0].set_title('Q-Q 图', fontsize=12, fontweight='bold')
        axes[1, 0].grid(True, alpha=0.3)

        axes[1, 1].acorr(residuals.dropna(), color='#ff7f0e', maxlags=20)
        axes[1, 1].set_title('自相关图', fontsize=12, fontweight='bold')
        axes[1, 1].set_xlabel('滞后')
        axes[1, 1].set_ylabel('自相关系数')
        axes[1, 1].grid(True, alpha=0.3)

        fig.suptitle(title, fontsize=14, fontweight='bold')
        plt.tight_layout()

        return fig

    def plot_actual_vs_predicted(
        self,
        actual: pd.Series,
        predicted: pd.Series,
        model_name: str = '模型',
        title: str = '实际值 vs 预测值'
    ) -> Figure:
        fig, axes = plt.subplots(1, 2, figsize=self.figsize)

        axes[0].plot(actual.index, actual.values, label='实际值', color='black', linewidth=2)
        axes[0].plot(predicted.index, predicted.values, label='预测值', color='#1f77b4', linewidth=2, linestyle='--')
        axes[0].set_title(f'{model_name} - 时间序列对比', fontsize=12, fontweight='bold')
        axes[0].set_xlabel('日期')
        axes[0].set_ylabel('数值')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)
        plt.setp(axes[0].xaxis.get_majorticklabels(), rotation=45)

        min_val = min(actual.min(), predicted.min())
        max_val = max(actual.max(), predicted.max())
        axes[1].scatter(actual.values, predicted.values, color='#2ca02c', alpha=0.6, s=50)
        axes[1].plot([min_val, max_val], [min_val, max_val], 'r--', linewidth=2)
        axes[1].set_title(f'{model_name} - 散点图', fontsize=12, fontweight='bold')
        axes[1].set_xlabel('实际值')
        axes[1].set_ylabel('预测值')
        axes[1].grid(True, alpha=0.3)

        fig.suptitle(title, fontsize=14, fontweight='bold')
        plt.tight_layout()

        return fig

    def plot_outliers(
        self,
        data: pd.Series,
        outlier_indices: list,
        title: str = '异常值检测'
    ) -> Figure:
        fig, ax = plt.subplots(figsize=self.figsize)

        ax.plot(data.index, data.values, label='数据', color='black', linewidth=1.5)

        if outlier_indices:
            outlier_values = data.loc[outlier_indices]
            ax.scatter(
                outlier_values.index,
                outlier_values.values,
                color='red',
                s=100,
                zorder=5,
                label='异常值',
                edgecolor='black',
                linewidth=1
            )

        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel('日期')
        ax.set_ylabel('数值')
        ax.legend()
        ax.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()

        return fig

    def plot_confidence_band_width(
        self,
        band_width: pd.Series,
        title: str = '置信区间带宽变化'
    ) -> Figure:
        fig, ax = plt.subplots(figsize=self.figsize)

        ax.plot(band_width.index, band_width.values, color='#1f77b4', linewidth=2, marker='o')
        ax.fill_between(band_width.index, 0, band_width.values, color='#1f77b4', alpha=0.3)

        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel('预测步数')
        ax.set_ylabel('置信区间宽度')
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        return fig

    @staticmethod
    def save_figure(fig: Figure, file_path: str, dpi: int = 300, **kwargs):
        fig.savefig(file_path, dpi=dpi, bbox_inches='tight', **kwargs)
        print(f"图表已保存至: {file_path}")
        plt.close(fig)
