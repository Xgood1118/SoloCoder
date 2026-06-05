import pandas as pd
import numpy as np
from typing import List, Dict, Optional, Tuple
from sklearn.metrics import mean_absolute_error, mean_squared_error
from enum import Enum


class SortMetric(Enum):
    MAE = "MAE"
    RMSE = "RMSE"
    MAPE = "MAPE"


class ModelComparator:
    def __init__(self, models: Optional[List] = None):
        self.models = models or []
        self.model_results = {}
        self.fitted_models = {}
        self.metrics = {}

    def add_model(self, model, name: Optional[str] = None):
        model_name = name or getattr(model, 'name', f"Model_{len(self.models) + 1}")
        self.models.append((model_name, model))
        return self

    def fit_all(self, data: pd.DataFrame, value_col: str, verbose: bool = True):
        for model_name, model in self.models:
            if verbose:
                print(f"正在训练模型: {model_name}...")
            try:
                model.fit(data, value_col)
                self.fitted_models[model_name] = model

                fitted_values = model.get_fitted_values()
                actual = data[value_col].loc[fitted_values.index]
                metrics = model.calculate_metrics(actual, fitted_values)
                self.metrics[model_name] = metrics

                if verbose:
                    print(f"  {model_name} 完成 - MAE: {metrics['MAE']:.4f}, RMSE: {metrics['RMSE']:.4f}, MAPE: {metrics['MAPE']:.4f}%")
            except Exception as e:
                if verbose:
                    print(f"  {model_name} 训练失败: {str(e)}")

        return self

    def predict_all(self, steps: int, alpha: float = 0.05) -> pd.DataFrame:
        all_predictions = []

        for model_name, model in self.fitted_models.items():
            try:
                pred_df = model.predict(steps=steps, alpha=alpha)
                if len(all_predictions) == 0:
                    all_predictions.append(pred_df)
                else:
                    all_predictions.append(pred_df)
            except Exception as e:
                print(f"{model_name} 预测失败: {str(e)}")

        if all_predictions:
            return pd.concat(all_predictions, axis=1)
        return pd.DataFrame()

    def get_comparison_table(self, sort_by: SortMetric = SortMetric.RMSE, ascending: bool = True) -> pd.DataFrame:
        if not self.metrics:
            raise ValueError("请先训练模型")

        comparison_df = pd.DataFrame.from_dict(self.metrics, orient='index')
        comparison_df = comparison_df.sort_values(by=sort_by.value, ascending=ascending)
        return comparison_df

    def get_best_model(self, metric: SortMetric = SortMetric.RMSE) -> Tuple[str, object, Dict]:
        comparison_df = self.get_comparison_table(sort_by=metric, ascending=True)
        best_model_name = comparison_df.index[0]
        best_model = self.fitted_models[best_model_name]
        best_metrics = self.metrics[best_model_name]
        return best_model_name, best_model, best_metrics

    def get_forecast_table(self, steps: int, alpha: float = 0.05) -> pd.DataFrame:
        predictions = self.predict_all(steps=steps, alpha=alpha)

        forecast_data = []
        for date in predictions.index:
            row = {'date': date}
            for model_name, _ in self.fitted_models.items():
                forecast_col = f"{model_name}_forecast"
                lower_col = f"{model_name}_lower"
                upper_col = f"{model_name}_upper"

                if forecast_col in predictions.columns:
                    row[f"{model_name}_预测值"] = predictions.loc[date, forecast_col]
                    row[f"{model_name}_下限"] = predictions.loc[date, lower_col]
                    row[f"{model_name}_上限"] = predictions.loc[date, upper_col]
            forecast_data.append(row)

        return pd.DataFrame(forecast_data).set_index('date')

    def export_forecast_to_csv(self, file_path: str, steps: int, alpha: float = 0.05, best_model_only: bool = False):
        forecast_table = self.get_forecast_table(steps=steps, alpha=alpha)

        if best_model_only:
            best_name, _, _ = self.get_best_model()
            cols = [col for col in forecast_table.columns if best_name in col]
            forecast_table = forecast_table[cols]

        forecast_table.to_csv(file_path, encoding='utf-8-sig')
        print(f"预测结果已导出至: {file_path}")

    def export_forecast_to_excel(self, file_path: str, steps: int, alpha: float = 0.05):
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            forecast_table = self.get_forecast_table(steps=steps, alpha=alpha)
            forecast_table.to_excel(writer, sheet_name='预测结果')

            comparison_table = self.get_comparison_table()
            comparison_table.to_excel(writer, sheet_name='模型对比')

        print(f"预测结果已导出至: {file_path}")

    @staticmethod
    def calculate_mape(actual: np.ndarray, predicted: np.ndarray) -> float:
        actual = np.array(actual)
        predicted = np.array(predicted)
        mask = actual != 0
        if np.sum(mask) == 0:
            return float('inf')
        return np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100

    def walk_forward_validation(
        self,
        data: pd.DataFrame,
        value_col: str,
        train_size: int,
        test_size: int,
        step: int = 1
    ) -> Dict[str, Dict]:
        validation_results = {}
        n = len(data)

        for model_name, model in self.models:
            print(f"正在对 {model_name} 进行滚动验证...")
            maes, rmses, mapes = [], [], []

            for i in range(train_size, n - test_size + 1, step):
                train_data = data.iloc[:i]
                test_data = data.iloc[i:i + test_size]

                try:
                    model.fit(train_data, value_col)
                    pred = model.predict(steps=test_size)
                    forecast_col = [c for c in pred.columns if 'forecast' in c][0]
                    predictions = pred[forecast_col].values[:len(test_data)]

                    actual = test_data[value_col].values
                    maes.append(mean_absolute_error(actual, predictions))
                    rmses.append(np.sqrt(mean_squared_error(actual, predictions)))
                    mapes.append(self.calculate_mape(actual, predictions))
                except Exception as e:
                    print(f"  验证步骤失败: {str(e)}")

            validation_results[model_name] = {
                'MAE_mean': np.mean(maes) if maes else None,
                'MAE_std': np.std(maes) if maes else None,
                'RMSE_mean': np.mean(rmses) if rmses else None,
                'RMSE_std': np.std(rmses) if rmses else None,
                'MAPE_mean': np.mean(mapes) if mapes else None,
                'MAPE_std': np.std(mapes) if mapes else None
            }

        return validation_results
