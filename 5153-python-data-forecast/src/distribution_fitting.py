import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from scipy import stats
from scipy.stats import (
    norm, lognorm, expon, weibull_min, gamma, beta, uniform
)
from enum import Enum


class DistributionType(Enum):
    NORMAL = "normal"
    LOGNORMAL = "lognormal"
    EXPONENTIAL = "exponential"
    WEIBULL = "weibull"
    GAMMA = "gamma"
    BETA = "beta"
    UNIFORM = "uniform"


class DistributionFitter:
    def __init__(self):
        self.data = None
        self.fitted_distributions = {}
        self.best_distribution = None

    def fit_distribution(
        self,
        data: np.ndarray,
        distribution_type: DistributionType
    ) -> Dict:
        self.data = np.array(data).flatten()
        dist_name = distribution_type.value

        if distribution_type == DistributionType.NORMAL:
            params = norm.fit(self.data)
            dist = norm
        elif distribution_type == DistributionType.LOGNORMAL:
            params = lognorm.fit(self.data, floc=0)
            dist = lognorm
        elif distribution_type == DistributionType.EXPONENTIAL:
            params = expon.fit(self.data, floc=0)
            dist = expon
        elif distribution_type == DistributionType.WEIBULL:
            params = weibull_min.fit(self.data, floc=0)
            dist = weibull_min
        elif distribution_type == DistributionType.GAMMA:
            params = gamma.fit(self.data, floc=0)
            dist = gamma
        elif distribution_type == DistributionType.BETA:
            data_min = self.data.min()
            data_max = self.data.max()
            scaled_data = (self.data - data_min) / (data_max - data_min)
            params = beta.fit(scaled_data)
            dist = beta
        elif distribution_type == DistributionType.UNIFORM:
            params = uniform.fit(self.data)
            dist = uniform
        else:
            raise ValueError(f"不支持的分布类型: {distribution_type}")

        ks_statistic, ks_pvalue = stats.kstest(self.data, dist_name, params)

        result = {
            'distribution': dist_name,
            'parameters': params,
            'ks_statistic': ks_statistic,
            'ks_pvalue': ks_pvalue,
            'aic': self._calculate_aic(params),
            'bic': self._calculate_bic(params),
            'distribution_object': dist
        }

        self.fitted_distributions[dist_name] = result
        return result

    def fit_all(
        self,
        data: np.ndarray,
        distributions: Optional[List[DistributionType]] = None
    ) -> pd.DataFrame:
        if distributions is None:
            distributions = [
                DistributionType.NORMAL,
                DistributionType.LOGNORMAL,
                DistributionType.EXPONENTIAL,
                DistributionType.WEIBULL,
                DistributionType.GAMMA
            ]

        results = []
        for dist_type in distributions:
            try:
                result = self.fit_distribution(data, dist_type)
                results.append({
                    'Distribution': result['distribution'],
                    'Parameters': str(result['parameters']),
                    'KS Statistic': result['ks_statistic'],
                    'KS p-value': result['ks_pvalue'],
                    'AIC': result['aic'],
                    'BIC': result['bic']
                })
            except Exception as e:
                print(f"{dist_type.value} 拟合失败: {str(e)}")

        results_df = pd.DataFrame(results).sort_values('AIC')
        self.best_distribution = results_df.iloc[0]['Distribution']
        return results_df

    def _calculate_aic(self, params: tuple) -> float:
        k = len(params)
        log_likelihood = np.sum(np.log(self._pdf(params)))
        return 2 * k - 2 * log_likelihood

    def _calculate_bic(self, params: tuple) -> float:
        k = len(params)
        n = len(self.data)
        log_likelihood = np.sum(np.log(self._pdf(params)))
        return k * np.log(n) - 2 * log_likelihood

    def _pdf(self, params: tuple) -> np.ndarray:
        dist_name = list(self.fitted_distributions.keys())[-1]
        dist = self.fitted_distributions[dist_name]['distribution_object']
        return dist.pdf(self.data, *params)

    def generate_samples(
        self,
        distribution_name: str,
        n_samples: int = 1000
    ) -> np.ndarray:
        if distribution_name not in self.fitted_distributions:
            raise ValueError(f"分布 {distribution_name} 尚未拟合")

        dist_info = self.fitted_distributions[distribution_name]
        dist = dist_info['distribution_object']
        params = dist_info['parameters']
        return dist.rvs(*params, size=n_samples)

    def monte_carlo_simulation(
        self,
        distribution_name: str,
        n_simulations: int = 10000,
        n_steps: int = 10,
        initial_value: float = 0.0,
        simulation_type: str = 'random_walk'
    ) -> np.ndarray:
        samples = self.generate_samples(distribution_name, n_simulations * n_steps)
        samples = samples.reshape(n_simulations, n_steps)

        if simulation_type == 'random_walk':
            paths = initial_value + np.cumsum(samples, axis=1)
        elif simulation_type == 'geometric':
            paths = initial_value * np.exp(np.cumsum(samples, axis=1))
        else:
            paths = samples

        return paths

    def get_percentiles(
        self,
        paths: np.ndarray,
        percentiles: List[float] = [5, 50, 95]
    ) -> Dict[float, np.ndarray]:
        return {p: np.percentile(paths, p, axis=0) for p in percentiles}

    def get_summary_statistics(self, data: Optional[np.ndarray] = None) -> Dict:
        data = data if data is not None else self.data
        return {
            'mean': np.mean(data),
            'median': np.median(data),
            'std': np.std(data),
            'min': np.min(data),
            'max': np.max(data),
            'skewness': stats.skew(data),
            'kurtosis': stats.kurtosis(data)
        }

    def plot_distribution_fit(
        self,
        distribution_name: str,
        bins: int = 50
    ):
        import matplotlib.pyplot as plt

        if distribution_name not in self.fitted_distributions:
            raise ValueError(f"分布 {distribution_name} 尚未拟合")

        dist_info = self.fitted_distributions[distribution_name]
        dist = dist_info['distribution_object']
        params = dist_info['parameters']

        fig, ax = plt.subplots(figsize=(10, 6))

        ax.hist(self.data, bins=bins, density=True, alpha=0.6, color='skyblue', edgecolor='black', label='数据直方图')

        x = np.linspace(self.data.min(), self.data.max(), 1000)
        ax.plot(x, dist.pdf(x, *params), 'r-', linewidth=2, label=f'{distribution_name} 拟合')

        ax.set_title(f'{distribution_name} 分布拟合', fontsize=14, fontweight='bold')
        ax.set_xlabel('数值')
        ax.set_ylabel('密度')
        ax.legend()
        ax.grid(True, alpha=0.3)

        return fig

    def plot_qq_plot(self, distribution_name: str):
        import matplotlib.pyplot as plt
        from scipy.stats import probplot

        if distribution_name not in self.fitted_distributions:
            raise ValueError(f"分布 {distribution_name} 尚未拟合")

        dist_info = self.fitted_distributions[distribution_name]
        dist = dist_info['distribution_object']

        fig, ax = plt.subplots(figsize=(10, 6))
        probplot(self.data, dist=dist, sparams=dist_info['parameters'], plot=ax)
        ax.set_title(f'{distribution_name} Q-Q 图', fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3)

        return fig

    def plot_monte_carlo_paths(
        self,
        paths: np.ndarray,
        n_paths_to_plot: int = 100,
        show_percentiles: bool = True
    ):
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(12, 6))

        n_simulations, n_steps = paths.shape
        indices = np.random.choice(n_simulations, min(n_paths_to_plot, n_simulations), replace=False)

        for idx in indices:
            ax.plot(paths[idx], color='gray', alpha=0.3, linewidth=1)

        if show_percentiles:
            percentiles = self.get_percentiles(paths, [5, 50, 95])
            ax.plot(percentiles[50], 'r--', linewidth=2, label='中位数 (50%)')
            ax.fill_between(
                range(n_steps),
                percentiles[5],
                percentiles[95],
                color='red',
                alpha=0.2,
                label='90% 置信区间'
            )

        ax.set_title('蒙特卡洛模拟路径', fontsize=14, fontweight='bold')
        ax.set_xlabel('步数')
        ax.set_ylabel('值')
        ax.legend()
        ax.grid(True, alpha=0.3)

        return fig
