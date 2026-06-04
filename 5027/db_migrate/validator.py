import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from .database import DatabaseConnection

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    table_name: str
    check_type: str
    passed: bool
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


class DataValidator:
    def __init__(self, db_connection: DatabaseConnection, config: Optional[Dict[str, Any]] = None):
        self.db = db_connection
        self.config = config or {}
        self.validation_rules = self.config.get("tables", [])

    def validate_all(self) -> List[ValidationResult]:
        results = []
        
        for rule in self.validation_rules:
            table_name = rule.get("name")
            if not table_name:
                continue

            if rule.get("check_count", False):
                results.extend(self._check_row_count(table_name, rule))
            
            if rule.get("check_indexes", False):
                results.extend(self._check_indexes(table_name, rule))
            
            if rule.get("check_constraints", False):
                results.extend(self._check_constraints(table_name, rule))

        return results

    def _check_row_count(self, table_name: str, rule: Dict[str, Any]) -> List[ValidationResult]:
        results = []
        
        try:
            count = self.db.get_table_row_count(table_name)
            min_count = rule.get("min_row_count", self.config.get("min_row_count", 0))
            max_count = rule.get("max_row_count")
            
            passed = count >= min_count
            if max_count is not None:
                passed = passed and count <= max_count
            
            message = f"Table {table_name} has {count} rows"
            if not passed:
                expected_range = f">= {min_count}"
                if max_count is not None:
                    expected_range += f", <= {max_count}"
                message = f"Table {table_name} row count {count} out of expected range ({expected_range})"
            
            results.append(ValidationResult(
                table_name=table_name,
                check_type="row_count",
                passed=passed,
                message=message,
                details={"actual": count, "min": min_count, "max": max_count}
            ))
            
        except Exception as e:
            results.append(ValidationResult(
                table_name=table_name,
                check_type="row_count",
                passed=False,
                message=f"Failed to check row count: {str(e)}"
            ))
        
        return results

    def _check_indexes(self, table_name: str, rule: Dict[str, Any]) -> List[ValidationResult]:
        results = []
        
        try:
            indexes = self.db.get_table_indexes(table_name)
            expected_indexes = rule.get("expected_indexes", [])
            
            if expected_indexes:
                actual_index_names = [idx.get("Key_name") or idx.get("indexname") for idx in indexes]
                
                for expected_idx in expected_indexes:
                    found = expected_idx in actual_index_names
                    results.append(ValidationResult(
                        table_name=table_name,
                        check_type="index_exists",
                        passed=found,
                        message=f"Index '{expected_idx}' {'found' if found else 'missing'}",
                        details={"index_name": expected_idx}
                    ))
            else:
                results.append(ValidationResult(
                    table_name=table_name,
                    check_type="index_exists",
                    passed=True,
                    message=f"Table {table_name} has {len(indexes)} indexes",
                    details={"index_count": len(indexes)}
                ))
            
        except Exception as e:
            results.append(ValidationResult(
                table_name=table_name,
                check_type="index_exists",
                passed=False,
                message=f"Failed to check indexes: {str(e)}"
            ))
        
        return results

    def _check_constraints(self, table_name: str, rule: Dict[str, Any]) -> List[ValidationResult]:
        results = []
        
        try:
            driver = self.db.config.get("driver")
            constraints = []
            
            if driver == "mysql":
                result = self.db.execute(f"""
                    SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name
                """, {"table_name": table_name})
                constraints = [dict(row._mapping) for row in result.fetchall()]
            
            elif driver == "postgresql":
                result = self.db.execute("""
                    SELECT constraint_name, constraint_type
                    FROM information_schema.table_constraints
                    WHERE table_name = :table_name
                """, {"table_name": table_name})
                constraints = [dict(row._mapping) for row in result.fetchall()]
            
            expected_constraints = rule.get("expected_constraints", [])
            
            if expected_constraints:
                actual_constraint_names = [c.get("CONSTRAINT_NAME") or c.get("constraint_name") for c in constraints]
                
                for expected_constraint in expected_constraints:
                    found = expected_constraint in actual_constraint_names
                    results.append(ValidationResult(
                        table_name=table_name,
                        check_type="constraint_exists",
                        passed=found,
                        message=f"Constraint '{expected_constraint}' {'found' if found else 'missing'}",
                        details={"constraint_name": expected_constraint}
                    ))
            else:
                constraint_types = [c.get("CONSTRAINT_TYPE") or c.get("constraint_type") for c in constraints]
                results.append(ValidationResult(
                    table_name=table_name,
                    check_type="constraint_exists",
                    passed=True,
                    message=f"Table {table_name} has constraints: {', '.join(constraint_types) if constraint_types else 'none'}",
                    details={"constraint_count": len(constraints)}
                ))
            
        except Exception as e:
            results.append(ValidationResult(
                table_name=table_name,
                check_type="constraint_exists",
                passed=False,
                message=f"Failed to check constraints: {str(e)}"
            ))
        
        return results

    def validate_table(self, table_name: str, check_count: bool = True,
                       check_indexes: bool = False, 
                       check_constraints: bool = False) -> List[ValidationResult]:
        results = []
        rule = {"name": table_name, "check_count": check_count, 
                "check_indexes": check_indexes, "check_constraints": check_constraints}
        
        if check_count:
            results.extend(self._check_row_count(table_name, rule))
        if check_indexes:
            results.extend(self._check_indexes(table_name, rule))
        if check_constraints:
            results.extend(self._check_constraints(table_name, rule))
        
        return results

    def get_validation_summary(self, results: List[ValidationResult]) -> Dict[str, Any]:
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        failed = total - passed
        
        by_table: Dict[str, List[ValidationResult]] = {}
        for result in results:
            if result.table_name not in by_table:
                by_table[result.table_name] = []
            by_table[result.table_name].append(result)
        
        table_summary = {}
        for table_name, table_results in by_table.items():
            table_passed = sum(1 for r in table_results if r.passed)
            table_summary[table_name] = {
                "total": len(table_results),
                "passed": table_passed,
                "failed": len(table_results) - table_passed,
                "all_passed": table_passed == len(table_results)
            }
        
        return {
            "total_checks": total,
            "passed_checks": passed,
            "failed_checks": failed,
            "all_passed": failed == 0,
            "by_table": table_summary
        }

    def print_validation_report(self, results: List[ValidationResult]) -> None:
        summary = self.get_validation_summary(results)
        
        print("\n" + "=" * 60)
        print("DATA VALIDATION REPORT")
        print("=" * 60)
        print(f"Total checks: {summary['total_checks']}")
        print(f"Passed:       {summary['passed_checks']}")
        print(f"Failed:       {summary['failed_checks']}")
        print(f"Status:       {'ALL PASSED' if summary['all_passed'] else 'HAS FAILURES'}")
        print("-" * 60)
        
        for result in results:
            status = "✓ PASS" if result.passed else "✗ FAIL"
            print(f"[{status}] {result.table_name} - {result.check_type}")
            if result.message:
                print(f"        {result.message}")
        
        print("=" * 60 + "\n")
