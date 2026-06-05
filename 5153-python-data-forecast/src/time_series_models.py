import pandas as pd
import numpy as np
import pickle
from typing import Optional, Dict, Tuple, Any
from abc import ABC, abstractmethod
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from sklearn.metrics import mean_absolute_error, mean_squared_error


class BaseTimeSeriesModel(ABC):
    def __init__(self, name: str):
        self.name = name
        self.model = None
        self.fitted_model = None
        self.history = None
        self.value_col = None
        self.residuals = None

    @abstractmethod
    def fit(self, data: pd.DataFrame, value_col: str, **kwargs) -> 'BaseTimeSeriesModel':
        pass

    @abstractmethod
    def predict(self, steps: int, alpha: float = 0.05, **kwargs) -> pd.DataFrame:
        pass

    def get_fitted_values(self) -> pd.Series:
        if self.fitted_model is None:
            raise ValueError("模型尚未训练")
        return self.fitted_model.fittedvalues

    def get_residuals(self) -> pd.Series:
        if self.fitted_model is None:
            raise ValueError("模型尚未训练")
        return self.fitted_model.resid

    def get_summary(self) -> Any:
        if self.fitted_model is None:
            raise ValueError("模型尚未训练")
        return self.fitted_model.summary()

    def calculate_metrics(self, actual: pd.Series, predicted: pd.Series) -> Dict[str, float]:
        mae = mean_absolute_error(actual, predicted)
        rmse = np.sqrt(mean_squared_error(actual, predicted))
        mape = np.mean(np.abs((actual - predicted) / actual)) * 100 if np.all(actual != 0) else np.inf
        return {'MAE': mae, 'RMSE': rmse, 'MAPE': mape}

    def save_model(self, file_path: str):
        with open(file_path, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'fitted_model': self.fitted_model,
                'name': self.name,
                'history': self.history,
                'value_col': self.value_col
            }, f)

    @classmethod
    def load_model(cls, file_path: str) -> 'BaseTimeSeriesModel':
        with open(file_path, 'rb') as f:
            data = pickle.load(f)
        instance = cls.__new__(cls)
        instance.model = data['model']
        instance.fitted_model = data['fitted_model']
        instance.name = data['name']
        instance.history = data['history']
        instance.value_col = data['value_col']
        instance.residuals = instance.fitted_model.resid if instance.fitted_model else None
        return instance


class ARIMAModel(BaseTimeSeriesModel):
    def __init__(self, order: Tuple[int, int, int] = (1, 1, 1)):
        super().__init__(f"ARIMA_{order[0]}_{order[1]}_{order[2]}")
        self.order = order

    def fit(self, data: pd.DataFrame, value_col: str, **kwargs) -> 'ARIMAModel':
        self.history = data.copy()
        self.value_col = value_col
        self.model = ARIMA(data[value_col], order=self.order, **kwargs)
        self.fitted_model = self.model.fit()
        self.residuals = self.fitted_model.resid
        return self

    def predict(self, steps: int, alpha: float = 0.05, **kwargs) -> pd.DataFrame:
        if self.fitted_model is None:
            raise ValueError("模型尚未训练")

        forecast = self.fitted_model.get_forecast(steps=steps)
        pred_mean = forecast.predicted_mean
        pred_ci = forecast.conf_int(alpha=alpha)

        future_dates = pd.date_range(
            start=self.history.index[-1] + pd.Timedelta(days=1),
            periods=steps,
            freq=self.history.index.freq
        )

        result = pd.DataFrame({
            'date': future_dates,
            f'{self.name}_forecast': pred_mean.values,
            f'{self.name}_lower': pred_ci.iloc[:, 0].values,
            f'{self.name}_upper': pred_ci.iloc[:, 1].values
        })
        return result.set_index('date')


class SARIMAModel(BaseTimeSeriesModel):
    def __init__(
        self,
        order: Tuple[int, int, int] = (1, 1, 1),
        seasonal_order: Tuple[int, int, int, int] = (1, 1, 1, 12)
    ):
        super().__init__(f"SARIMA_{order[0]}_{order[1]}_{order[2]}_{seasonal_order[3]}")
        self.order = order
        self.seasonal_order = seasonal_order

    def fit(self, data: pd.DataFrame, value_col: str, **kwargs) -> 'SARIMAModel':
        self.history = data.copy()
        self.value_col = value_col
        self.model = SARIMAX(
            data[value_col],
            order=self.order,
            seasonal_order=self.seasonal_order,
            **kwargs
        )
        self.fitted_model = self.model.fit(disp=False)
        self.residuals = self.fitted_model.resid
        return self

    def predict(self, steps: int, alpha: float = 0.05, **kwargs) -> pd.DataFrame:
        if self.fitted_model is None:
            raise ValueError("模型尚未训练")

        forecast = self.fitted_model.get_forecast(steps=steps)
        pred_mean = forecast.predicted_mean
        pred_ci = forecast.conf_int(alpha=alpha)

        future_dates = pd.date_range(
            start=self.history.index[-1] + pd.Timedelta(days=1),
            periods=steps,
            freq=self.history.index.freq
        )

        result = pd.DataFrame({
            'date': future_dates,
            f'{self.name}_forecast': pred_mean.values,
            f'{self.name}_lower': pred_ci.iloc[:, 0].values,
            f'{self.name}_upper': pred_ci.iloc[:, 1].values
        })
        return result.set_index('date')


class ExponentialSmoothingModel(BaseTimeSeriesModel):
    def __init__(
        self,
        trend: Optional[str] = 'add',
        seasonal: Optional[str] = 'add',
        seasonal_periods: int = 12
    ):
        name = f"ETS_{trend or 'N'}_{seasonal or 'N'}_{seasonal_periods}"
        super().__init__(name)
        self.trend = trend
        self.seasonal = seasonal
        self.seasonal_periods = seasonal_periods

    def fit(self, data: pd.DataFrame, value_col: str, **kwargs) -> 'ExponentialSmoothingModel':
        self.history = data.copy()
        self.value_col = value_col
        self.model = ExponentialSmoothing(
            data[value_col],
            trend=self.trend,
            seasonal=self.seasonal,
            seasonal_periods=self.seasonal_periods,
            **kwargs
        )
        self.fitted_model = self.model.fit()
        self.residuals = self.fitted_model.resid
        return self

    def predict(self, steps: int, alpha: float = 0.05, **kwargs) -> pd.DataFrame:
        if self.fitted_model is None:
            raise ValueError("模型尚未训练")

        pred_mean = self.fitted_model.forecast(steps=steps)

        residuals = self.get_residuals().dropna()
        std_error = residuals.std()
        z_score = 1.96 if alpha == 0.05 else (1.645 if alpha == 0.10 else 2.576)
        horizon_effect = np.sqrt(np.arange(1, steps + 1))
        margin = z_score * std_error * horizon_effect

        future_dates = pd.date_range(
            start=self.history.index[-1] + pd.Timedelta(days=1),
            periods=steps,
            freq=self.history.index.freq
        )

        result = pd.DataFrame({
            'date': future_dates,
            f'{self.name}_forecast': pred_mean.values,
            f'{self.name}_lower': pred_mean.values - margin,
            f'{self.name}_upper': pred_mean.values + margin
        })
        return result.set_index('date')


class ProphetModel(BaseTimeSeriesModel):
    def __init__(self, yearly_seasonality: bool = True, weekly_seasonality: bool = True, daily_seasonality: bool = False):
        super().__init__("Prophet")
        self.yearly_seasonality = yearly_seasonality
        self.weekly_seasonality = weekly_seasonality
        self.daily_seasonality = daily_seasonality
        self._model = None

    def fit(self, data: pd.DataFrame, value_col: str, **kwargs) -> 'ProphetModel':
        from prophet import Prophet

        self.history = data.copy()
        self.value_col = value_col

        df_prophet = pd.DataFrame({
            'ds': data.index,
            'y': data[value_col].values
        })

        self._model = Prophet(
            yearly_seasonality=self.yearly_seasonality,
            weekly_seasonality=self.weekly_seasonality,
            daily_seasonality=self.daily_seasonality,
            **kwargs
        )
        self.fitted_model = self._model.fit(df_prophet)

        fitted = self.fitted_model.predict(df_prophet)
        self.residuals = pd.Series(df_prophet['y'].values - fitted['yhat'].values, index=data.index)

        return self

    def predict(self, steps: int, alpha: float = 0.05, **kwargs) -> pd.DataFrame:
        if self.fitted_model is None:
            raise ValueError("模型尚未训练")

        future = self.fitted_model.make_future_dataframe(periods=steps, freq=self.history.index.freq)
        forecast = self.fitted_model.predict(future)

        forecast_future = forecast.tail(steps)

        result = pd.DataFrame({
            'date': forecast_future['ds'].values,
            f'{self.name}_forecast': forecast_future['yhat'].values,
            f'{self.name}_lower': forecast_future['yhat_lower'].values,
            f'{self.name}_upper': forecast_future['yhat_upper'].values
        })
        return result.set_index('date')
