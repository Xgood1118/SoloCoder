import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnInit,
  ChangeDetectionStrategy
} from '@angular/core';
import {
  Subject,
  Observable,
  combineLatest,
  of,
  BehaviorSubject
} from 'rxjs';
import {
  takeUntil,
  switchMap,
  map,
  distinctUntilChanged,
  debounceTime,
  tap
} from 'rxjs/operators';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { ChartType, DataPoint, LinkageEvent, TriggerEventType } from '../../../types/dashboard.types';

@Component({
  selector: 'app-chart-renderer',
  standalone: true,
  template: `
    <div #chartContainer class="chart-container"></div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
      height: 100%;
      min-height: 200px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartRendererComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data$!: Observable<DataPoint[]>;
  @Input() chartType: ChartType = 'line';
  @Input() color = '#5470c6';
  @Input() title = '';
  @Input() highlightTimestamp: number | null = null;
  @Input() widgetId = '';

  @Output() linkageEvent = new EventEmitter<{ eventType: TriggerEventType; data: LinkageEvent['data'] }>();

  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;

  private readonly destroy$ = new Subject<void>();
  private readonly chartType$ = new BehaviorSubject<ChartType>('line');
  private readonly dataPoints$ = new BehaviorSubject<DataPoint[]>([]);
  private chart!: echarts.ECharts;
  private resizeObserver!: ResizeObserver;

  ngOnInit(): void {
    this.initChart();
    this.setupDataPipeline();
    this.setupResizeObserver();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chartType'] && !changes['chartType'].isFirstChange()) {
      this.chartType$.next(this.chartType);
    }
    if (changes['highlightTimestamp'] && this.highlightTimestamp) {
      this.highlightDataPoint(this.highlightTimestamp);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
  }

  private initChart(): void {
    this.chart = echarts.init(this.chartContainer.nativeElement, undefined, {
      renderer: 'canvas',
      useDirtyRect: true
    });

    this.chart.on('click', (params: unknown) => this.handleChartInteraction('click', params));
    this.chart.on('mouseover', (params: unknown) => this.handleChartInteraction('hover', params));

    window.addEventListener('resize', () => this.chart?.resize());
  }

  private setupDataPipeline(): void {
    const dataStream$ = this.data$.pipe(
      tap(data => this.dataPoints$.next(data)),
      takeUntil(this.destroy$)
    );

    combineLatest([
      this.chartType$.pipe(distinctUntilChanged()),
      this.dataPoints$.pipe(debounceTime(100))
    ]).pipe(
      takeUntil(this.destroy$),
      switchMap(([type, data]) => this.generateChartOptions(type, data)),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ).subscribe(options => {
      this.chart.setOption(options, {
        notMerge: false,
        lazyUpdate: true
      });
    });

    dataStream$.subscribe();
  }

  private generateChartOptions(type: ChartType, data: DataPoint[]): Observable<EChartsOption> {
    switch (type) {
      case 'line':
        return of(this.generateLineChartOptions(data));
      case 'bar':
        return of(this.generateBarChartOptions(data));
      case 'pie':
        return of(this.generatePieChartOptions(data));
      case 'gauge':
        return of(this.generateGaugeChartOptions(data));
      default:
        return of(this.generateLineChartOptions(data));
    }
  }

  private generateLineChartOptions(data: DataPoint[]): EChartsOption {
    const xData = data.map(d => this.formatTime(d.timestamp));
    const yData = data.map(d => d.value);

    return {
      backgroundColor: 'transparent',
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(50, 50, 50, 0.9)',
        borderColor: 'transparent',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => this.formatTooltip(params)
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xData,
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { lineStyle: { color: '#333', type: 'dashed' } }
      },
      series: [{
        name: this.title,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: {
          color: this.color,
          width: 2
        },
        itemStyle: {
          color: this.color
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: this.color + '40' },
            { offset: 1, color: this.color + '05' }
          ])
        },
        data: yData,
        animationDuration: 500,
        animationEasing: 'cubicOut'
      }]
    };
  }

  private generateBarChartOptions(data: DataPoint[]): EChartsOption {
    const xData = data.map(d => this.formatTime(d.timestamp));
    const yData = data.map(d => d.value);

    return {
      backgroundColor: 'transparent',
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(50, 50, 50, 0.9)',
        borderColor: 'transparent',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => this.formatTooltip(params)
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { lineStyle: { color: '#333', type: 'dashed' } }
      },
      series: [{
        name: this.title,
        type: 'bar',
        barWidth: '60%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: this.color + 'CC' },
            { offset: 1, color: this.color + '66' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        data: yData,
        animationDuration: 500,
        animationEasing: 'elasticOut'
      }]
    };
  }

  private generatePieChartOptions(data: DataPoint[]): EChartsOption {
    const pieData = data.slice(-8).map(d => ({
      name: this.formatTime(d.timestamp),
      value: d.value
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(50, 50, 50, 0.9)',
        borderColor: 'transparent',
        textStyle: { color: '#fff' },
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#888', fontSize: 10 }
      },
      series: [{
        name: this.title,
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#1a1a2e',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold',
            color: '#fff'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        data: pieData,
        animationDuration: 500,
        animationEasing: 'cubicOut'
      }]
    };
  }

  private generateGaugeChartOptions(data: DataPoint[]): EChartsOption {
    const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
    const maxValue = Math.max(...data.map(d => d.value), 100);

    return {
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: maxValue,
        splitNumber: 10,
        radius: '90%',
        progress: {
          show: true,
          width: 20,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#91cc75' },
              { offset: 0.5, color: '#fac858' },
              { offset: 1, color: '#ee6666' }
            ])
          }
        },
        pointer: {
          show: true,
          length: '60%',
          width: 6,
          itemStyle: {
            color: '#fff'
          }
        },
        axisLine: {
          lineStyle: {
            width: 20,
            color: [[1, '#333']]
          }
        },
        axisTick: {
          distance: -30,
          splitNumber: 5,
          lineStyle: {
            color: '#555',
            width: 1
          }
        },
        splitLine: {
          distance: -35,
          length: 10,
          lineStyle: {
            color: '#666',
            width: 2
          }
        },
        axisLabel: {
          distance: -20,
          color: '#888',
          fontSize: 10
        },
        anchor: {
          show: true,
          showAbove: true,
          size: 20,
          itemStyle: {
            borderWidth: 4,
            borderColor: this.color
          }
        },
        title: {
          show: true,
          offsetCenter: [0, '70%'],
          fontSize: 12,
          color: '#888'
        },
        detail: {
          valueAnimation: true,
          fontSize: 24,
          fontWeight: 'bold',
          offsetCenter: [0, '20%'],
          formatter: '{value}',
          color: this.color
        },
        data: [{
          value: latestValue,
          name: this.title
        }],
        animationDuration: 800,
        animationEasing: 'cubicOut'
      }]
    };
  }

  private handleChartInteraction(eventType: TriggerEventType, params: unknown): void {
    const typedParams = params as {
      dataIndex?: number;
      name?: string;
      value?: number;
    };

    if (typedParams.dataIndex == null) return;

    const dataPoints = this.dataPoints$.value;
    const dataPoint = dataPoints[typedParams.dataIndex];

    if (!dataPoint) return;

    this.linkageEvent.emit({
      eventType,
      data: {
        timestamp: dataPoint.timestamp,
        value: dataPoint.value,
        label: dataPoint.label
      }
    });
  }

  private highlightDataPoint(timestamp: number): void {
    const dataPoints = this.dataPoints$.value;
    const index = dataPoints.findIndex(d => d.timestamp >= timestamp);

    if (index >= 0) {
      this.chart.dispatchAction({
        type: 'highlight',
        seriesIndex: 0,
        dataIndex: index
      });

      this.chart.dispatchAction({
        type: 'showTip',
        seriesIndex: 0,
        dataIndex: index
      });
    }
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  }

  private formatTooltip(params: unknown): string {
    const typedParams = params as Array<{ name: string; value: number; marker: string; seriesName: string }>;
    if (!Array.isArray(typedParams) || typedParams.length === 0) return '';

    const param = typedParams[0];
    const dataPoints = this.dataPoints$.value;
    const dataPoint = dataPoints.find(d => this.formatTime(d.timestamp) === param.name);

    return `
      <div style="padding: 4px 8px;">
        <div style="color: #888; font-size: 11px; margin-bottom: 4px;">${param.name}</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${param.marker}
          <span style="color: #fff;">${param.seriesName}:</span>
          <span style="color: ${this.color}; font-weight: bold;">${dataPoint?.label ?? param.value}</span>
        </div>
      </div>
    `;
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.resize({
        animation: {
          duration: 300
        }
      });
    });
    this.resizeObserver.observe(this.chartContainer.nativeElement);
  }
}
