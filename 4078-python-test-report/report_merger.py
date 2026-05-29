#!/usr/bin/env python3
import os


def get_testcase_key(tc):
    return tc['full_name']


def merge_two_suites(suite1, suite2):
    merged_testcases = {}

    for tc in suite1['testcases']:
        key = get_testcase_key(tc)
        merged_testcases[key] = tc.copy()

    for tc in suite2['testcases']:
        key = get_testcase_key(tc)
        if key in merged_testcases:
            existing = merged_testcases[key]
            if tc['status'] == 'failed':
                existing['status'] = 'failed'
                existing['message'] = tc['message'] or existing['message']
                existing['stack_trace'] = tc['stack_trace'] or existing['stack_trace']
                if tc['file'] not in existing.get('source_files', []):
                    existing.setdefault('source_files', []).append(tc['file'])
            existing['time'] = max(existing['time'], tc['time'])
        else:
            merged_testcases[key] = tc.copy()
            merged_testcases[key]['source_files'] = [tc['file']]

    for key in merged_testcases:
        if 'source_files' not in merged_testcases[key]:
            merged_testcases[key]['source_files'] = [suite1.get('file', 'unknown')]

    return {
        'name': suite1['name'],
        'testcases': list(merged_testcases.values()),
        'source_files': list(set(
            [suite1.get('file', '')] + [suite2.get('file', '')]
        ))
    }


def merge_reports(parsed_reports):
    merged_suites = {}
    all_files = []

    for report in parsed_reports:
        all_files.append(report['file'])
        for suite in report['testsuites']:
            suite_name = suite['name']
            if suite_name in merged_suites:
                merged_suites[suite_name] = merge_two_suites(
                    merged_suites[suite_name], suite
                )
            else:
                suite_copy = suite.copy()
                suite_copy['source_files'] = [report['file']]
                for tc in suite_copy['testcases']:
                    tc['source_files'] = [report['file']]
                merged_suites[suite_name] = suite_copy

    total = 0
    passed = 0
    failed = 0
    skipped = 0
    duration = 0.0
    all_testcases = []

    for suite in merged_suites.values():
        for tc in suite['testcases']:
            total += 1
            duration += tc['time']
            all_testcases.append(tc)
            if tc['status'] == 'passed':
                passed += 1
            elif tc['status'] == 'failed':
                failed += 1
            elif tc['status'] == 'skipped':
                skipped += 1

    return {
        'testsuites': list(merged_suites.values()),
        'total': total,
        'passed': passed,
        'failed': failed,
        'skipped': skipped,
        'duration': duration,
        'files': all_files,
        'testcases': all_testcases,
        'per_file_stats': get_per_file_stats(parsed_reports)
    }


def get_per_file_stats(parsed_reports):
    stats = []
    for report in parsed_reports:
        pass_rate = (report['passed'] / report['total'] * 100) if report['total'] > 0 else 0
        stats.append({
            'filename': os.path.basename(report['file']),
            'filepath': report['file'],
            'total': report['total'],
            'passed': report['passed'],
            'failed': report['failed'],
            'skipped': report['skipped'],
            'pass_rate': pass_rate,
            'level': report['level']
        })
    return stats


def detect_frequent_failures(parsed_reports, min_failures=2):
    failure_counts = {}

    for report in parsed_reports:
        for suite in report['testsuites']:
            for tc in suite['testcases']:
                if tc['status'] == 'failed':
                    key = tc['full_name']
                    if key not in failure_counts:
                        failure_counts[key] = {
                            'name': tc['full_name'],
                            'classname': tc['classname'],
                            'method': tc['name'],
                            'failure_count': 0,
                            'files': [],
                            'messages': []
                        }
                    count_data = failure_counts[key]
                    count_data['failure_count'] += 1
                    if report['file'] not in count_data['files']:
                        count_data['files'].append(report['file'])
                    if tc['message'] and tc['message'] not in count_data['messages']:
                        count_data['messages'].append(tc['message'])

    frequent_failures = [
        data for data in failure_counts.values()
        if data['failure_count'] >= min_failures
    ]

    return sorted(frequent_failures, key=lambda x: x['failure_count'], reverse=True)
