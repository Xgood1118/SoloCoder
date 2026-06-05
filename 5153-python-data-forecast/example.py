import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from src.forecast_pipeline import ForecastPipeline
from src.auto_arima import AutoARIMA
from src.distribution_fitting import DistributionFitter, DistributionType
from src.visualization import ForecastVisualizer


def generate_sample_data(n_periods: int = 120, save_path: str = 'sample_data.csv'):
    print("生成示例数据...")

    dates = pd.date_range(start='2015-01-01', periods=n_periods, freq='M')
    trend = np.linspace(100, 200, n_periods)
    seasonal = 20 * np.sin(2 * np.pi * np.arange(n_periods) / 12)
    noise = np.random.normal(0, 5, n_periods)
    values = trend + seasonal + noise

    df = pd.DataFrame({'date': dates, 'value': values})
    df.to_csv(save_path, index=False)
    print(f"示例数据已保存至: {save_path}")

    return df


def example_basic_forecast():
    print("=" * 60)
    print("示例 1: 基本时间序列预测")
    print("=" * 60)

    generate_sample_data()

    pipeline = ForecastPipeline(
        use_seasonal_adjustment=True,
        confidence_level=0.95
    )

    results = pipeline.run_pipeline(
        file_path='sample_data.csv',
        steps=12,
        export_path='forecast_results.csv'
    )

    print(f"\n最优模型: {results['best_model_name']}")
    print(f"最优模型指标: {results['best_metrics']}")
    print(f"\n预测结果预览:")
    print(results['predictions'].head())


def example_auto_arima():
    print("\n" + "=" * 60)
    print("示例 2: 使用 pmdarima 自动选择 ARIMA 参数")
    print("=" * 60)

    df = generate_sample_data()
    from src.data_preprocessing import DataPreprocessor

    preprocessor = DataPreprocessor()
    processed_data, info = preprocessor.preprocess(df)

    auto_arima = AutoARIMA(
        seasonal=True,
        seasonal_periods=12,
        max_p=3,
        max_q=3,
        show_progress=True
    )

    auto_arima.fit(processed_data, info['value_column'])

    print("\n模型摘要:")
    print(auto_arima.get_summary())

    predictions = auto_arima.predict(steps=12)
    print("\n预测结果:")
    print(predictions)


def example_distribution_fitting():
    print("\n" + "=" * 60)
    print("示例 3: 使用 scipy 进行分布拟合和蒙特卡洛模拟")
    print("=" * 60)

    np.random.seed(42)
    data = np.random.normal(loc=50, scale=10, size=1000)

    fitter = DistributionFitter()

    results = fitter.fit_all(data)
    print("\n分布拟合结果:")
    print(results)

    best_dist = fitter.best_distribution
    print(f"\n最优分布: {best_dist}")

    print("\n生成随机样本并进行蒙特卡洛模拟...")
    paths = fitter.monte_carlo_simulation(
        distribution_name=best_dist,
        n_simulations=10000,
        n_steps=50,
        initial_value=100
    )

    percentiles = fitter.get_percentiles(paths, [5, 50, 95])
    print(f"第50步 5% 分位数: {percentiles[5][-1]:.2f}")
    print(f"第50步 50% 分位数: {percentiles[50][-1]:.2f}")
    print(f"第50步 95% 分位数: {percentiles[95][-1]:.2f}")


def example_visualization():
    print("\n" + "=" * 60)
    print("示例 4: 结果可视化")
    print("=" * 60)

    pipeline = ForecastPipeline(
        use_seasonal_adjustment=True,
        confidence_level=0.95
    )

    pipeline.load_data('sample_data.csv')
    pipeline.set_default_models(seasonal_periods=12)
    pipeline.fit(verbose=False)

    print("\n生成预测图表...")
    fig1 = pipeline.plot_forecast(steps=12)
    fig1.savefig('forecast_plot.png', dpi=300, bbox_inches='tight')
    print("预测图表已保存: forecast_plot.png")

    print("\n生成模型对比图表...")
    fig2 = pipeline.plot_model_comparison()
    fig2.savefig('model_comparison.png', dpi=300, bbox_inches='tight')
    print("模型对比图表已保存: model_comparison.png")

    print("\n生成季节性分解图表...")
    fig3 = pipeline.plot_decomposition()
    fig3.savefig('decomposition_plot.png', dpi=300, bbox_inches='tight')
    print("季节性分解图表已保存: decomposition_plot.png")

    plt.close('all')


def example_export_results():
    print("\n" + "=" * 60)
    print("示例 5: 导出结果")
    print("=" * 60)

    pipeline = ForecastPipeline(
        use_seasonal_adjustment=True,
        confidence_level=0.95
    )

    pipeline.load_data('sample_data.csv')
    pipeline.set_default_models(seasonal_periods=12)
    pipeline.fit(verbose=False)

    print("\n导出为 CSV...")
    pipeline.export_results(steps=12, file_path='forecast_output.csv', format='csv')

    print("\n导出为 Excel...")
    pipeline.export_results(steps=12, file_path='forecast_output.xlsx', format='excel')


if __name__ == '__main__':
    np.random.seed(42)

    try:
        example_basic_forecast()
    except Exception as e:
        print(f"示例 1 执行出错: {e}")
        import traceback
        traceback.print_exc()

    try:
        example_auto_arima()
    except Exception as e:
        print(f"示例 2 执行出错: {e}")
        import traceback
        traceback.print_exc()

    try:
        example_distribution_fitting()
    except Exception as e:
        print(f"示例 3 执行出错: {e}")
        import traceback
        traceback.print_exc()

    try:
        example_visualization()
    except Exception as e:
        print(f"示例 4 执行出错: {e}")
        import traceback
        traceback.print_exc()

    try:
        example_export_results()
    except Exception as e:
        print(f"示例 5 执行出错: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    print("所有示例执行完成!")
    print("=" * 60)
