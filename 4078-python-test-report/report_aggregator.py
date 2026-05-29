#!/usr/bin/env python3
import argparse
import os
import sys
from datetime import datetime

from xml_parser import parse_xml_file
from report_merger import merge_reports, detect_frequent_failures
from trend_analyzer import analyze_trends
from html_generator import generate_html_report


def find_xml_files(root_dir):
    xml_files = []
    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith('.xml'):
                full_path = os.path.join(dirpath, filename)
                xml_files.append(full_path)
    return xml_files


def extract_sort_key(filepath):
    import re
    filename = os.path.basename(filepath)
    numbers = re.findall(r'\d+', filename)
    if numbers:
        return (0, int(''.join(numbers)))
    return (1, filename.lower())


def sort_files_by_timestamp(files):
    return sorted(files, key=extract_sort_key)


def print_summary(merged_data, frequent_failures):
    total = merged_data['total']
    passed = merged_data['passed']
    failed = merged_data['failed']
    skipped = merged_data['skipped']
    duration = merged_data['duration']
    pass_rate = (passed / total * 100) if total > 0 else 0

    print("\n" + "=" * 60)
    print("测试报告聚合摘要")
    print("=" * 60)
    print(f"总用例数: {total}")
    print(f"通过: {passed}")
    print(f"失败: {failed}")
    print(f"跳过: {skipped}")
    print(f"通过率: {pass_rate:.2f}%")
    print(f"累计耗时: {duration:.2f} 秒")
    print("-" * 60)

    if frequent_failures:
        print(f"\n高频失败用例 ({len(frequent_failures)} 个):")
        for tc in frequent_failures:
            print(f"  - {tc['name']}: 失败 {tc['failure_count']} 次")
            print(f"    文件: {', '.join(tc['files'][:3])}")
            if len(tc['files']) > 3:
                print(f"          ... 还有 {len(tc['files']) - 3} 个文件")

    print("\n" + "=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(description='多源测试报告聚合与分析平台')
    parser.add_argument('root_dir', help='JUnit XML 报告所在根目录')
    parser.add_argument('--output', default='test_report.html', help='输出 HTML 报告路径')
    parser.add_argument('--trend', action='store_true', help='启用趋势分析')
    parser.add_argument('--level', choices=['all', 'unit', 'integration', 'e2e'], 
                        default='all', help='测试层级过滤')

    args = parser.parse_args()

    if not os.path.isdir(args.root_dir):
        print(f"错误: 目录不存在 - {args.root_dir}")
        sys.exit(1)

    print(f"扫描目录: {args.root_dir}")
    xml_files = find_xml_files(args.root_dir)
    
    if not xml_files:
        print("未找到任何 XML 文件")
        sys.exit(0)

    print(f"找到 {len(xml_files)} 个 XML 文件")
    sorted_files = sort_files_by_timestamp(xml_files)

    parsed_reports = []
    for filepath in sorted_files:
        try:
            report_data = parse_xml_file(filepath)
            parsed_reports.append(report_data)
            print(f"  ✓ 已解析: {os.path.basename(filepath)}")
        except Exception as e:
            print(f"  ✗ 解析失败: {os.path.basename(filepath)} - {e}")

    if not parsed_reports:
        print("没有成功解析的报告文件")
        sys.exit(1)

    print(f"\n合并 {len(parsed_reports)} 份报告...")
    merged_data = merge_reports(parsed_reports)
    frequent_failures = detect_frequent_failures(parsed_reports)

    trends = None
    if args.trend:
        print("执行趋势分析...")
        trends = analyze_trends(parsed_reports)

    print(f"生成 HTML 报告: {args.output}")
    generate_html_report(merged_data, frequent_failures, trends, args.output)

    print_summary(merged_data, frequent_failures)
    print(f"报告已生成: {os.path.abspath(args.output)}")


if __name__ == '__main__':
    main()
