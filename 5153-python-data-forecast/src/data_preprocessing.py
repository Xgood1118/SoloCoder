import pandas as pd
import numpy as np
from typing import Optional, Tuple, List, Dict
from enum import Enum


class MissingValueMethod(Enum):
    FORWARD_FILL = "ffill"
    BACKWARD_FILL = "bfill"
    LINEAR = "linear"
    MEAN = "mean"
    MEDIAN = "median"
    INTERPOLATE = "interpolate"


class OutlierMethod(Enum):
    IQR = "iqr"
    ZSCORE = "zscore"
    PERCENTILE = "percentile"


class OutlierHandling(Enum):
    REMOVE = "remove"
    REPLACE = "replace"
    KEEP = "keep"


class DataPreprocessor:
    def __init__(
        self,
        missing_value_method: MissingValueMethod = MissingValueMethod.LINEAR,
        outlier_method: OutlierMethod = OutlierMethod.IQR,
        outlier_handling: OutlierHandling = OutlierHandling.REPLACE,
        outlier_threshold: float = 1.5,
        detect_frequency: bool = True
    ):
        self.missing_value_method = missing_value_method
        self.outlier_method = outlier_method
        self.outlier_handling = outlier_handling
        self.outlier_threshold = outlier_threshold
        self.detect_frequency = detect_frequency
        self.outlier_indices: List = []
        self.frequency: Optional[str] = None
        self.time_col: Optional[str] = None
        self.value_col: Optional[str] = None

    def load_csv(self, file_path: str, time_col: Optional[str] = None, value_col: Optional[str] = None) -> pd.DataFrame:
        df = pd.read_csv(file_path)
        return self._process_dataframe(df, time_col, value_col)

    def _process_dataframe(self, df: pd.DataFrame, time_col: Optional[str] = None, value_col: Optional[str] = None) -> pd.DataFrame:
        if time_col is None:
            time_col = self._detect_time_column(df)
        if value_col is None:
            value_col = self._detect_value_column(df, time_col)

        self.time_col = time_col
        self.value_col = value_col

        df[time_col] = pd.to_datetime(df[time_col])
        df = df.sort_values(time_col).reset_index(drop=True)
        df = df.set_index(time_col)

        if self.detect_frequency:
            self.frequency = self._detect_frequency(df.index)
            df = df.asfreq(self.frequency)

        return df

    def _detect_time_column(self, df: pd.DataFrame) -> str:
        for col in df.columns:
            if df[col].dtype == 'object':
                try:
                    pd.to_datetime(df[col])
                    return col
                except (ValueError, TypeError):
                    continue
            elif 'datetime' in str(df[col].dtype).lower():
                return col
        raise ValueError("无法自动识别时间戳列，请手动指定")

    def _detect_value_column(self, df: pd.DataFrame, time_col: str) -> str:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if time_col in numeric_cols:
            numeric_cols.remove(time_col)
        if len(numeric_cols) == 0:
            raise ValueError("未找到数值列")
        return numeric_cols[0]

    def _detect_frequency(self, index: pd.DatetimeIndex) -> str:
        freq = pd.infer_freq(index)
        if freq is None:
            diffs = index.to_series().diff().dropna()
            median_diff = diffs.median()
            if median_diff < pd.Timedelta(hours=1):
                freq = 'min'
            elif median_diff < pd.Timedelta(days=1):
                freq = 'h'
            elif median_diff < pd.Timedelta(days=7):
                freq = 'D'
            elif median_diff < pd.Timedelta(days=30):
                freq = 'W'
            else:
                freq = 'M'
        return freq

    def handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        df_clean = df.copy()
        value_col = self.value_col if self.value_col else df_clean.columns[0]

        if self.missing_value_method == MissingValueMethod.FORWARD_FILL:
            df_clean[value_col] = df_clean[value_col].ffill()
        elif self.missing_value_method == MissingValueMethod.BACKWARD_FILL:
            df_clean[value_col] = df_clean[value_col].bfill()
        elif self.missing_value_method == MissingValueMethod.LINEAR:
            df_clean[value_col] = df_clean[value_col].interpolate(method='linear')
        elif self.missing_value_method == MissingValueMethod.MEAN:
            df_clean[value_col] = df_clean[value_col].fillna(df_clean[value_col].mean())
        elif self.missing_value_method == MissingValueMethod.MEDIAN:
            df_clean[value_col] = df_clean[value_col].fillna(df_clean[value_col].median())
        elif self.missing_value_method == MissingValueMethod.INTERPOLATE:
            df_clean[value_col] = df_clean[value_col].interpolate(method='time')

        return df_clean

    def detect_outliers(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List]:
        df_clean = df.copy()
        value_col = self.value_col if self.value_col else df_clean.columns[0]
        values = df_clean[value_col].dropna()

        if self.outlier_method == OutlierMethod.IQR:
            Q1 = values.quantile(0.25)
            Q3 = values.quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - self.outlier_threshold * IQR
            upper_bound = Q3 + self.outlier_threshold * IQR
            outliers = df_clean[(df_clean[value_col] < lower_bound) | (df_clean[value_col] > upper_bound)].index.tolist()

        elif self.outlier_method == OutlierMethod.ZSCORE:
            z_scores = np.abs((values - values.mean()) / values.std())
            outliers = df_clean[z_scores > self.outlier_threshold].index.tolist()

        elif self.outlier_method == OutlierMethod.PERCENTILE:
            lower_pct = self.outlier_threshold
            upper_pct = 100 - self.outlier_threshold
            lower_bound = values.quantile(lower_pct / 100)
            upper_bound = values.quantile(upper_pct / 100)
            outliers = df_clean[(df_clean[value_col] < lower_bound) | (df_clean[value_col] > upper_bound)].index.tolist()

        else:
            outliers = []

        self.outlier_indices = outliers
        return df_clean, outliers

    def handle_outliers(self, df: pd.DataFrame, outliers: List) -> pd.DataFrame:
        if not outliers or self.outlier_handling == OutlierHandling.KEEP:
            return df

        df_clean = df.copy()
        value_col = self.value_col if self.value_col else df_clean.columns[0]

        if self.outlier_handling == OutlierHandling.REMOVE:
            df_clean = df_clean.drop(outliers)

        elif self.outlier_handling == OutlierHandling.REPLACE:
            for idx in outliers:
                pos = df_clean.index.get_loc(idx)
                prev_idx = pos - 1 if pos > 0 else pos + 1
                next_idx = pos + 1 if pos < len(df_clean) - 1 else pos - 1
                df_clean.loc[idx, value_col] = (df_clean.iloc[prev_idx][value_col] + df_clean.iloc[next_idx][value_col]) / 2

        return df_clean

    def preprocess(self, df: pd.DataFrame, time_col: Optional[str] = None, value_col: Optional[str] = None) -> Tuple[pd.DataFrame, Dict]:
        df = self._process_dataframe(df, time_col, value_col)
        df = self.handle_missing_values(df)
        df, outliers = self.detect_outliers(df)
        df = self.handle_outliers(df, outliers)

        info = {
            'time_column': self.time_col,
            'value_column': self.value_col,
            'frequency': self.frequency,
            'outliers_count': len(outliers),
            'outlier_indices': outliers
        }

        return df, info

    def get_frequency_periods(self, freq: Optional[str] = None) -> int:
        freq = freq or self.frequency
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
