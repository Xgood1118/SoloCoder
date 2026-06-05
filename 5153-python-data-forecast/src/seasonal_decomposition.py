import pandas as pd
import numpy as np
from typing import Optional, Dict, Tuple
from enum import Enum
from statsmodels.tsa.seasonal import seasonal_decompose, STL


class DecompositionMethod(Enum):
    ADDITIVE = "additive"
    MULTIPLICATIVE = "multiplicative"


class DecompositionType(Enum):
    CLASSICAL = "classical"
    STL = "stl"


class SeasonalDecomposer:
    def __init__(
        self,
        method: DecompositionMethod = DecompositionMethod.ADDITIVE,
        decomposition_type: DecompositionType = DecompositionType.STL,
        seasonal_period: Optional[int] = None,
        robust: bool = True
    ):
        self.method = method
        self.decomposition_type = decomposition_type
        self.seasonal_period = seasonal_period
        self.robust = robust
        self.trend = None
        self.seasonal = None
        self.residual = None
        self.observed = None
        self.decomposition_result = None

    def _infer_seasonal_period(self, data: pd.DataFrame, value_col: str) -> int:
        if self.seasonal_period is not None:
            return self.seasonal_period

        freq = data.index.freqstr if data.index.freq else None
        freq_map = {
            'min': 1440,
            'h': 24,
            'D': 7,
            'W': 52,
            'M': 12,
            'Q': 4,
            'A': 1
        }
        return freq_map.get(freq, 12)

    def decompose(
        self,
        data: pd.DataFrame,
        value_col: str,
        **kwargs
    ) -> Dict[str, pd.Series]:
        self.observed = data[value_col].copy()
        period = self._infer_seasonal_period(data, value_col)

        if self.decomposition_type == DecompositionType.CLASSICAL:
            self.decomposition_result = seasonal_decompose(
                self.observed,
                model=self.method.value,
                period=period,
                extrapolate_trend='freq',
                **kwargs
            )
            self.trend = self.decomposition_result.trend
            self.seasonal = self.decomposition_result.seasonal
            self.residual = self.decomposition_result.resid

        elif self.decomposition_type == DecompositionType.STL:
            self.decomposition_result = STL(
                self.observed,
                period=period,
                robust=self.robust,
                **kwargs
            ).fit()
            self.trend = self.decomposition_result.trend
            self.seasonal = self.decomposition_result.seasonal
            self.residual = self.decomposition_result.resid

        return {
            'observed': self.observed,
            'trend': self.trend,
            'seasonal': self.seasonal,
            'residual': self.residual
        }

    def remove_seasonality(self, data: pd.DataFrame, value_col: str) -> pd.Series:
        if self.seasonal is None:
            self.decompose(data, value_col)

        if self.method == DecompositionMethod.ADDITIVE:
            deseasonalized = self.observed - self.seasonal
        else:
            deseasonalized = self.observed / self.seasonal

        return deseasonalized

    def adjust_forecast(
        self,
        forecast: pd.Series,
        forecast_dates: pd.DatetimeIndex
    ) -> pd.Series:
        if self.seasonal is None:
            raise ValueError("请先运行季节性分解")

        period = len(self.seasonal) // len(self.seasonal.dropna().unique()) if hasattr(self.seasonal, 'unique') else 12
        seasonal_indices = np.arange(len(forecast)) % period
        seasonal_component = self.seasonal.iloc[-period:].values[seasonal_indices]

        if self.method == DecompositionMethod.ADDITIVE:
            adjusted_forecast = forecast.values + seasonal_component
        else:
            adjusted_forecast = forecast.values * seasonal_component

        return pd.Series(adjusted_forecast, index=forecast_dates)

    def adjust_confidence_interval(
        self,
        lower: pd.Series,
        upper: pd.Series,
        forecast_dates: pd.DatetimeIndex
    ) -> Tuple[pd.Series, pd.Series]:
        if self.seasonal is None:
            raise ValueError("请先运行季节性分解")

        period = len(self.seasonal) // len(self.seasonal.dropna().unique()) if hasattr(self.seasonal, 'unique') else 12
        seasonal_indices = np.arange(len(lower)) % period
        seasonal_component = self.seasonal.iloc[-period:].values[seasonal_indices]

        if self.method == DecompositionMethod.ADDITIVE:
            adjusted_lower = lower.values + seasonal_component
            adjusted_upper = upper.values + seasonal_component
        else:
            adjusted_lower = lower.values * seasonal_component
            adjusted_upper = upper.values * seasonal_component

        return (
            pd.Series(adjusted_lower, index=forecast_dates),
            pd.Series(adjusted_upper, index=forecast_dates)
        )

    def get_components(self) -> pd.DataFrame:
        if self.trend is None:
            raise ValueError("请先运行季节性分解")

        return pd.DataFrame({
            'observed': self.observed,
            'trend': self.trend,
            'seasonal': self.seasonal,
            'residual': self.residual
        })

    def detect_multiple_seasonality(
        self,
        data: pd.DataFrame,
        value_col: str,
        periods: Optional[list] = None
    ) -> Dict[int, float]:
        if periods is None:
            periods = [7, 12, 24, 52]

        strength_scores = {}
        for period in periods:
            try:
                decomp = seasonal_decompose(
                    data[value_col],
                    model='additive',
                    period=period,
                    extrapolate_trend='freq'
                )
                seasonal_var = np.var(decomp.seasonal.dropna())
                total_var = np.var(data[value_col])
                strength = seasonal_var / total_var if total_var > 0 else 0
                strength_scores[period] = strength
            except:
                strength_scores[period] = 0

        return strength_scores

    def get_summary(self) -> Dict:
        if self.trend is None:
            raise ValueError("请先运行季节性分解")

        seasonal_strength = np.var(self.seasonal.dropna()) / np.var(self.observed) if np.var(self.observed) > 0 else 0
        trend_strength = np.var(self.trend.dropna()) / np.var(self.observed) if np.var(self.observed) > 0 else 0

        return {
            'method': self.method.value,
            'decomposition_type': self.decomposition_type.value,
            'seasonal_period': self.seasonal_period,
            'seasonal_strength': seasonal_strength,
            'trend_strength': trend_strength,
            'residual_mean': self.residual.mean(),
            'residual_std': self.residual.std()
        }
