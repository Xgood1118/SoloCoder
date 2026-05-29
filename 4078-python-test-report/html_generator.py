#!/usr/bin/env python3
import os
from datetime import datetime


def generate_html_report(merged_data, frequent_failures, trends, output_path):
    html_content = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>测试报告聚合分析</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        h1 {{
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }}
        h2 {{
            color: #333;
            margin-bottom: 20px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }}
        .section {{
            background: white;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }}
        .cards {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }}
        .card {{
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
            border-radius: 12px;
            padding: 25px;
            text-align: center;
            transition: transform 0.3s, box-shadow 0.3s;
            border-left: 5px solid #667eea;
        }}
        .card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }}
        .card.passed {{ border-left-color: #28a745; }}
        .card.failed {{ border-left-color: #dc3545; }}
        .card.skipped {{ border-left-color: #ffc107; }}
        .card.rate {{ border-left-color: #17a2b8; }}
        .card.duration {{ border-left-color: #6f42c1; }}
        .card-value {{
            font-size: 2.5em;
            font-weight: bold;
            color: #333;
            margin: 10px 0;
        }}
        .card-label {{
            color: #666;
            font-size: 0.95em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        .chart-container {{
            margin-top: 20px;
            overflow-x: auto;
        }}
        .bar-chart {{
            display: flex;
            align-items: flex-end;
            gap: 15px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            min-height: 300px;
        }}
        .bar-item {{
            flex: 1;
            min-width: 80px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        .bar {{
            width: 100%;
            border-radius: 8px 8px 0 0;
            position: relative;
            transition: all 0.3s;
            cursor: pointer;
        }}
        .bar:hover {{
            filter: brightness(1.1);
        }}
        .bar-label {{
            margin-top: 10px;
            font-size: 0.8em;
            text-align: center;
            word-wrap: break-word;
            max-width: 100px;
        }}
        .bar-value {{
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.85em;
            font-weight: bold;
            color: #333;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }}
        th, td {{
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }}
        th {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: 600;
        }}
        tr:hover {{
            background-color: #f5f5f5;
        }}
        tr.failed-row {{
            background-color: #ffebee;
        }}
        tr.failed-row:hover {{
            background-color: #ffcdd2;
        }}
        .tooltip {{
            position: relative;
            cursor: help;
        }}
        .tooltip-content {{
            visibility: hidden;
            position: absolute;
            z-index: 100;
            background: #333;
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-size: 0.85em;
            white-space: pre-wrap;
            max-width: 600px;
            max-height: 300px;
            overflow-y: auto;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-bottom: 10px;
        }}
        .tooltip:hover .tooltip-content {{
            visibility: visible;
        }}
        .badge {{
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 600;
        }}
        .badge-pass {{ background: #d4edda; color: #155724; }}
        .badge-fail {{ background: #f8d7da; color: #721c24; }}
        .badge-skip {{ background: #fff3cd; color: #856404; }}
        .frequent-failure {{
            background: linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%);
            border-left: 5px solid #dc3545;
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 8px;
        }}
        .frequent-failure h4 {{
            color: #721c24;
            margin-bottom: 10px;
        }}
        .file-list {{
            font-size: 0.85em;
            color: #666;
            margin-top: 10px;
        }}
        .meta-info {{
            text-align: right;
            color: #999;
            font-size: 0.9em;
            margin-top: 20px;
        }}
        .trend-up {{ color: #28a745; }}
        .trend-down {{ color: #dc3545; }}
        .trend-stable {{ color: #6c757d; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 多源测试报告聚合分析</h1>
        
        <div class="section">
            <h2>📈 总览</h2>
            {generate_overview_cards(merged_data)}
            {generate_trend_summary(trends)}
        </div>

        <div class="section">
            <h2>📊 文件通过率分布</h2>
            <div class="chart-container">
                {generate_bar_chart(merged_data['per_file_stats'])}
            </div>
        </div>

        {generate_frequent_failures_section(frequent_failures)}

        <div class="section">
            <h2>❌ 失败用例详情</h2>
            {generate_failure_table(merged_data)}
        </div>

        <div class="meta-info">
            生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | 
            报告文件数: {len(merged_data['files'])}
        </div>
    </div>
</body>
</html>
"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)


def generate_overview_cards(merged_data):
    total = merged_data['total']
    passed = merged_data['passed']
    failed = merged_data['failed']
    skipped = merged_data['skipped']
    duration = merged_data['duration']
    pass_rate = (passed / total * 100) if total > 0 else 0

    return f"""
    <div class="cards">
        <div class="card">
            <div class="card-label">总用例数</div>
            <div class="card-value">{total}</div>
        </div>
        <div class="card passed">
            <div class="card-label">✅ 通过</div>
            <div class="card-value" style="color: #28a745;">{passed}</div>
        </div>
        <div class="card failed">
            <div class="card-label">❌ 失败</div>
            <div class="card-value" style="color: #dc3545;">{failed}</div>
        </div>
        <div class="card skipped">
            <div class="card-label">⏭️ 跳过</div>
            <div class="card-value" style="color: #ffc107;">{skipped}</div>
        </div>
        <div class="card rate">
            <div class="card-label">📈 通过率</div>
            <div class="card-value" style="color: {'#28a745' if pass_rate >= 80 else '#dc3545' if pass_rate < 50 else '#ffc107'};">{pass_rate:.1f}%</div>
        </div>
        <div class="card duration">
            <div class="card-label">⏱️ 耗时</div>
            <div class="card-value" style="color: #6f42c1;">{duration:.1f}s</div>
        </div>
    </div>
    """


def generate_trend_summary(trends):
    if not trends:
        return ''

    summary = trends['summary']
    pass_rate_icon = '↑' if summary['pass_rate_trend_direction'] == 'up' else '↓' if summary['pass_rate_trend_direction'] == 'down' else '→'
    fail_icon = '↑' if summary['failure_trend_direction'] == 'up' else '↓' if summary['failure_trend_direction'] == 'down' else '→'
    pass_rate_class = f"trend-{summary['pass_rate_trend_direction']}"
    fail_class = f"trend-{summary['failure_trend_direction']}"

    return f"""
    <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <strong>📈 趋势分析（基于 {summary['build_count']} 份报告）：</strong>
        <span class="{pass_rate_class}">通过率 {pass_rate_icon} {summary['pass_rate_change']:+.1f}%</span> |
        <span class="{fail_class}">失败数 {fail_icon} {summary['failure_change']:+d}</span>
    </div>
    """


def generate_bar_chart(per_file_stats):
    if not per_file_stats:
        return '<p>暂无数据</p>'

    max_height = 250
    bars = []

    for stat in per_file_stats:
        pass_rate = stat['pass_rate']
        height = (pass_rate / 100) * max_height
        color = '#28a745' if pass_rate >= 80 else '#ffc107' if pass_rate >= 50 else '#dc3545'
        level_color = {
            'unit': '#667eea',
            'integration': '#f6993f',
            'e2e': '#e3342f'
        }.get(stat['level'], '#6c757d')

        bars.append(f"""
        <div class="bar-item">
            <div class="bar" style="height: {height}px; background: {color};">
                <span class="bar-value">{pass_rate:.1f}%</span>
            </div>
            <div class="bar-label">
                <div style="font-size: 0.75em; color: {level_color}; font-weight: bold;">[{stat['level']}]</div>
                <div>{stat['filename'][:20]}...</div>
                <div style="font-size: 0.75em; color: #999;">{stat['passed']}/{stat['total']}</div>
            </div>
        </div>
        """)

    return f"""
    <div class="bar-chart">
        {''.join(bars)}
    </div>
    """


def generate_frequent_failures_section(frequent_failures):
    if not frequent_failures:
        return ''

    items = []
    for ff in frequent_failures:
        files_html = '<br>'.join([os.path.basename(f) for f in ff['files'][:5]])
        if len(ff['files']) > 5:
            files_html += f'<br>... 还有 {len(ff["files"]) - 5} 个文件'

        items.append(f"""
        <div class="frequent-failure">
            <h4>🔥 {ff['name']}</h4>
            <div><strong>失败次数:</strong> <span style="color: #dc3545; font-size: 1.2em; font-weight: bold;">{ff['failure_count']}</span></div>
            <div><strong>失败消息:</strong> {'; '.join(ff['messages'][:3])}</div>
            <div class="file-list"><strong>出现文件:</strong><br>{files_html}</div>
        </div>
        """)

    return f"""
    <div class="section">
        <h2>🔥 高频失败用例 ({len(frequent_failures)})</h2>
        {''.join(items)}
    </div>
    """


def generate_failure_table(merged_data):
    failed_cases = [tc for tc in merged_data['testcases'] if tc['status'] == 'failed']
    
    if not failed_cases:
        return '<p style="color: #28a745; font-size: 1.1em;">🎉 太棒了！没有失败的测试用例</p>'

    rows = []
    for tc in failed_cases:
        stack_preview = tc['stack_trace'][:200] + '...' if len(tc['stack_trace']) > 200 else tc['stack_trace']
        rows.append(f"""
        <tr class="failed-row">
            <td class="tooltip">
                {tc['full_name']}
                <div class="tooltip-content"><strong>完整堆栈:</strong><br>{tc['stack_trace'] or '无堆栈信息'}</div>
            </td>
            <td>{os.path.basename(tc.get('file', 'unknown'))}</td>
            <td>{tc['message'] or '无消息'}</td>
            <td class="tooltip">
                {stack_preview or '无'}
                <div class="tooltip-content"><strong>完整堆栈:</strong><br>{tc['stack_trace'] or '无堆栈信息'}</div>
            </td>
        </tr>
        """)

    return f"""
    <table>
        <thead>
            <tr>
                <th>用例名称</th>
                <th>来源文件</th>
                <th>失败消息</th>
                <th>堆栈摘要</th>
            </tr>
        </thead>
        <tbody>
            {''.join(rows)}
        </tbody>
    </table>
    """
