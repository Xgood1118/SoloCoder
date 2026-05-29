#!/usr/bin/env python3
import os
import xml.etree.ElementTree as ET


def parse_testcase(testcase_elem):
    name = testcase_elem.get('name', '')
    classname = testcase_elem.get('classname', '')
    time_str = testcase_elem.get('time', '0')
    
    try:
        time = float(time_str)
    except (ValueError, TypeError):
        time = 0.0

    status = 'passed'
    message = ''
    stack_trace = ''

    failure_elem = testcase_elem.find('failure')
    if failure_elem is not None:
        status = 'failed'
        message = failure_elem.get('message', '')
        stack_trace = failure_elem.text or ''

    error_elem = testcase_elem.find('error')
    if error_elem is not None:
        status = 'failed'
        message = error_elem.get('message', message) or ''
        stack_trace = error_elem.text or stack_trace or ''

    skipped_elem = testcase_elem.find('skipped')
    if skipped_elem is not None:
        status = 'skipped'
        message = skipped_elem.get('message', '')
        stack_trace = ''

    full_name = f"{classname}.{name}" if classname else name

    return {
        'name': name,
        'classname': classname,
        'full_name': full_name,
        'time': time,
        'status': status,
        'message': message,
        'stack_trace': stack_trace
    }


def parse_testsuite(testsuite_elem, filepath):
    suite_name = testsuite_elem.get('name', 'unknown')
    
    testcases = []
    for testcase_elem in testsuite_elem.findall('testcase'):
        tc = parse_testcase(testcase_elem)
        tc['file'] = filepath
        testcases.append(tc)

    return {
        'name': suite_name,
        'testcases': testcases,
        'file': filepath
    }


def parse_xml_file(filepath):
    tree = ET.parse(filepath)
    root = tree.getroot()

    filename = os.path.basename(filepath)
    level = detect_test_level(filename)

    testsuites = []

    if root.tag == 'testsuites':
        for testsuite_elem in root.findall('testsuite'):
            suite = parse_testsuite(testsuite_elem, filepath)
            suite['level'] = level
            testsuites.append(suite)
    elif root.tag == 'testsuite':
        suite = parse_testsuite(root, filepath)
        suite['level'] = level
        testsuites.append(suite)

    total = 0
    passed = 0
    failed = 0
    skipped = 0
    duration = 0.0

    for suite in testsuites:
        for tc in suite['testcases']:
            total += 1
            duration += tc['time']
            if tc['status'] == 'passed':
                passed += 1
            elif tc['status'] == 'failed':
                failed += 1
            elif tc['status'] == 'skipped':
                skipped += 1

    return {
        'file': filepath,
        'filename': filename,
        'level': level,
        'testsuites': testsuites,
        'total': total,
        'passed': passed,
        'failed': failed,
        'skipped': skipped,
        'duration': duration
    }


def detect_test_level(filename):
    filename_lower = filename.lower()
    
    level_keywords = {
        'unit': ['unit', 'unittest'],
        'integration': ['integration', 'integrate', 'int'],
        'e2e': ['e2e', 'endtoend', 'end-to-end', 'ui', 'selenium']
    }

    for level, keywords in level_keywords.items():
        for keyword in keywords:
            if keyword in filename_lower:
                return level

    return 'unit'
