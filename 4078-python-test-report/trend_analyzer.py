#!/usr/bin/env python3
import os


def analyze_trends(parsed_reports):
    if len(parsed_reports) < 2:
        return None

    trends = {
        'pass_rate_trend': [],
        'total_tests_trend': [],
        'failure_trend': [],
        'duration_trend': [],
        'summary': {}
    }

    for i, report in enumerate(parsed_reports):
        pass_rate = (report['passed'] / report['total'] * 100) if report['total'] > 0 else 0
        trends['pass_rate_trend'].append({
            'build': os.path.basename(report['file']),
            'value': pass_rate,
            'index': i
        })
        trends['total_tests_trend'].append({
            'build': os.path.basename(report['file']),
            'value': report['total'],
            'index': i
        })
        trends['failure_trend'].append({
            'build': os.path.basename(report['file']),
            'value': report['failed'],
            'index': i
        })
        trends['duration_trend'].append({
            'build': os.path.basename(report['file']),
            'value': report['duration'],
            'index': i
        })

    first_pass = trends['pass_rate_trend'][0]['value']
    last_pass = trends['pass_rate_trend'][-1]['value']
    pass_rate_change = last_pass - first_pass

    first_failed = trends['failure_trend'][0]['value']
    last_failed = trends['failure_trend'][-1]['value']
    failure_change = last_failed - first_failed

    trends['summary'] = {
        'pass_rate_change': pass_rate_change,
        'pass_rate_trend_direction': 'up' if pass_rate_change > 0 else 'down' if pass_rate_change < 0 else 'stable',
        'failure_change': failure_change,
        'failure_trend_direction': 'up' if failure_change > 0 else 'down' if failure_change < 0 else 'stable',
        'build_count': len(parsed_reports)
    }

    return trends
