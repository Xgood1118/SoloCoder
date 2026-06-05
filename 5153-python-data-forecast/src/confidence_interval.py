import numpy as np
import pandas as pd
from typing import Optional, Tuple
from scipy import stats
from enum import Enum


class ConfidenceLevel(Enum):
    CL_90 = 0.90
    CL_95 = 0.95
    CL_99 = 0.99


class ConfidenceIntervalMethod(Enum):
    NORMAL = "normal"
    T_DISTRIBUTION = "t_distribution"
    BOOTSTRAP = "bootstrap"
    RESIDUAL_QUANTILE = "residual_quantile"


class ConfidenceIntervalCalculator:
    def __init__(
        self,
        confidence_level: float = 0.95,
        method: ConfidenceIntervalMethod = ConfidenceIntervalMethod.NORMAL
    ):
        self.confidence_level = confidence_level
        self.method = method
        self.alpha = 1 - confidence_level

    def set_confidence_level(self, level: float):
        if not (0 < level < 1):
            raise ValueError("置信水平必须在 0 和 1 之间")
        self.confidence_level = level
        self.alpha = 1 - level

    def _get_z_score(self) -> float:
        return stats.norm.ppf(1 - self.alpha / 2)

    def _get_t_score(self, df: int) -> float:
        return stats.t.ppf(1 - self.alpha / 2, df)

    def calculate_from_residuals(
        self,
        residuals: pd.Series,
        forecast: np.ndarray,
        horizon_effect: bool = True
    ) -> Tuple[np.ndarray, np.ndarray]:
        residuals = residuals.dropna().values
        n = len(residuals)
        std_error = np.std(residuals, ddof=1)
        steps = len(forecast)

        if self.method == ConfidenceIntervalMethod.NORMAL:
            score = self._get_z_score()
            if horizon_effect:
                margin = score * std_error * np.sqrt(np.arange(1, steps + 1))
            else:
                margin = score * std_error

        elif self.method == ConfidenceIntervalMethod.T_DISTRIBUTION:
            score = self._get_t_score(n - 1)
            if horizon_effect:
                margin = score * std_error * np.sqrt(np.arange(1, steps + 1))
            else:
                margin = score * std_error

        elif self.method == ConfidenceIntervalMethod.BOOTSTRAP:
            n_bootstraps = 1000
            bootstrap_forecasts = []
            for _ in range(n_bootstraps):
                bootstrap_residuals = np.random.choice(residuals, size=steps, replace=True)
                if horizon_effect:
                    cumulative_residuals = np.cumsum(bootstrap_residuals) / np.sqrt(np.arange(1, steps + 1))
                else:
                    cumulative_residuals = bootstrap_residuals
                bootstrap_forecasts.append(forecast + cumulative_residuals)

            bootstrap_forecasts = np.array(bootstrap_forecasts)
            lower = np.percentile(bootstrap_forecasts, (self.alpha / 2) * 100, axis=0)
            upper = np.percentile(bootstrap_forecasts, (1 - self.alpha / 2) * 100, axis=0)
            return lower, upper

        elif self.method == ConfidenceIntervalMethod.RESIDUAL_QUANTILE:
            lower_q = np.percentile(residuals, (self.alpha / 2) * 100)
            upper_q = np.percentile(residuals, (1 - self.alpha / 2) * 100)
            if horizon_effect:
                horizon_scale = np.sqrt(np.arange(1, steps + 1))
                lower = forecast + lower_q * horizon_scale
                upper = forecast + upper_q * horizon_scale
            else:
                lower = forecast + lower_q
                upper = forecast + upper_q
            return lower, upper

        else:
            raise ValueError(f"不支持的方法: {self.method}")

        return forecast - margin, forecast + margin

    def calculate_from_prediction_interval(
        self,
        pred_mean: np.ndarray,
        se_mean: np.ndarray,
        n_obs: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        if self.method == ConfidenceIntervalMethod.NORMAL:
            score = self._get_z_score()
        else:
            score = self._get_t_score(n_obs - 2)

        margin = score * se_mean
        return pred_mean - margin, pred_mean + margin

    def calculate_for_quantiles(
        self,
        data: np.ndarray,
        quantiles: Optional[list] = None
    ) -> dict:
        if quantiles is None:
            quantiles = [self.alpha / 2, 0.5, 1 - self.alpha / 2]

        results = {}
        for q in quantiles:
            results[f"quantile_{int(q * 100)}"] = np.percentile(data, q * 100)

        return results

    def estimate_prediction_band_width(
        self,
        residuals: pd.Series,
        steps: int
    ) -> pd.Series:
        residuals = residuals.dropna().values
        std_error = np.std(residuals, ddof=1)
        score = self._get_z_score()
        horizon_effect = np.sqrt(np.arange(1, steps + 1))
        band_width = 2 * score * std_error * horizon_effect

        return pd.Series(band_width, index=np.arange(1, steps + 1))

    def compare_confidence_levels(
        self,
        residuals: pd.Series,
        forecast: np.ndarray,
        levels: Optional[list] = None
    ) -> dict:
        if levels is None:
            levels = [0.90, 0.95, 0.99]

        results = {}
        original_level = self.confidence_level

        for level in levels:
            self.confidence_level = level
            self.alpha = 1 - level
            lower, upper = self.calculate_from_residuals(residuals, forecast)
            results[f"level_{int(level * 100)}"] = {
                'lower': lower,
                'upper': upper,
                'band_width': upper - lower
            }

        self.confidence_level = original_level
        self.alpha = 1 - original_level

        return results

    @staticmethod
    def interpret_interval(
        lower: float,
        upper: float,
        point_estimate: float
    ) -> dict:
        width = upper - lower
        relative_width = width / abs(point_estimate) if point_estimate != 0 else float('inf')

        return {
            'lower_bound': lower,
            'upper_bound': upper,
            'point_estimate': point_estimate,
            'absolute_width': width,
            'relative_width': relative_width,
            'symmetry': (point_estimate - lower) / width if width > 0 else 0.5
        }
