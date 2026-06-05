import pandas as pd
import numpy as np
import pickle
from typing import Optional, Dict, Tuple
from pmdarima import auto_arima, ARIMA
from tqdm import tqdm
import warnings


class AutoARIMA:
    def __init__(
        self,
        seasonal: bool = True,
        seasonal_periods: Optional[int] = None,
        max_p: int = 5,
        max_q: int = 5,
        max_P: int = 2,
        max_Q: int = 2,
        max_d: int = 2,
        max_D: int = 1,
        information_criterion: str = 'aic',
        suppress_warnings: bool = True,
        show_progress: bool = True
    ):
        self.seasonal = seasonal
        self.seasonal_periods = seasonal_periods
        self.max_p = max_p
        self.max_q = max_q
        self.max_P = max_P
        self.max_Q = max_Q
        self.max_d = max_d
        self.max_D = max_D
        self.information_criterion = information_criterion
        self.suppress_warnings = suppress_warnings
        self.show_progress = show_progress
        self.model = None
        self.order = None
        self.seasonal_order = None
        self.history = None
        self.value_col = None
        self.residuals = None

    def fit(
        self,
        data: pd.DataFrame,
        value_col: str,
        **kwargs
    ) -> 'AutoARIMA':
        self.history = data.copy()
        self.value_col = self.value_col or value_col
        y = data[value_col].values

        if self.seasonal_periods is None and self.seasonal:
            self.seasonal_periods = self._infer_seasonal_periods(data)

        with warnings.catch_warnings():
            if self.suppress_warnings:
                warnings.filterwarnings("ignore")

            if self.show_progress:
                print("正在自动搜索最优 ARIMA 参数...")

            self.model = auto_arima(
                y,
                seasonal=self.seasonal,
                m=self.seasonal_periods or 1,
                max_p=self.max_p,
                max_q=self.max_q,
                max_P=self.max_P,
                max_Q=self.max_Q,
                max_d=self.max_d,
                max_D=self.max_D,
                information_criterion=self.information_criterion,
                trace=self.show_progress,
                error_action='ignore',
                suppress_warnings=self.suppress_warnings,
                stepwise=True,
                **kwargs
            )

        self.order = self.model.order
        self.seasonal_order = self.model.seasonal_order
        self.residuals = pd.Series(self.model.resid(), index=data.index)

        print(f"最优参数: order={self.order}, seasonal_order={self.seasonal_order}")

        return self

    def _infer_seasonal_periods(self, data: pd.DataFrame) -> int:
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

    def predict(
        self,
        steps: int,
        alpha: float = 0.05,
        return_conf_int: bool = True
    ) -> pd.DataFrame:
        if self.model is None:
            raise ValueError("模型尚未训练")

        pred_mean, conf_int = self.model.predict(
            n_periods=steps,
            return_conf_int=True,
            alpha=alpha
        )

        future_dates = pd.date_range(
            start=self.history.index[-1] + pd.Timedelta(days=1),
            periods=steps,
            freq=self.history.index.freq
        )

        result = pd.DataFrame({
            'date': future_dates,
            'AutoARIMA_forecast': pred_mean,
            'AutoARIMA_lower': conf_int[:, 0],
            'AutoARIMA_upper': conf_int[:, 1]
        })
        return result.set_index('date')

    def get_residuals(self) -> pd.Series:
        if self.residuals is None:
            raise ValueError("模型尚未训练")
        return self.residuals

    def get_summary(self):
        if self.model is None:
            raise ValueError("模型尚未训练")
        return self.model.summary()

    def get_best_params(self) -> Dict:
        return {
            'order': self.order,
            'seasonal_order': self.seasonal_order,
            'seasonal_periods': self.seasonal_periods
        }

    def save_model(self, file_path: str):
        with open(file_path, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'order': self.order,
                'seasonal_order': self.seasonal_order,
                'seasonal_periods': self.seasonal_periods,
                'history': self.history,
                'value_col': self.value_col
            }, f)

    @classmethod
    def load_model(cls, file_path: str) -> 'AutoARIMA':
        with open(file_path, 'rb') as f:
            data = pickle.load(f)
        instance = cls()
        instance.model = data['model']
        instance.order = data['order']
        instance.seasonal_order = data['seasonal_order']
        instance.seasonal_periods = data['seasonal_periods']
        instance.history = data['history']
        instance.value_col = data['value_col']
        return instance

    def to_statsmodels_arima(self):
        from statsmodels.tsa.arima.model import ARIMA as SM_ARIMA
        if self.order is None:
            raise ValueError("请先训练模型")

        sm_model = SM_ARIMA(
            self.history[self.value_col],
            order=self.order,
            seasonal_order=self.seasonal_order if self.seasonal else None
        )
        return sm_model.fit()
