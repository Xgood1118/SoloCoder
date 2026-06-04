package condition

import (
	"approval-flow/internal/models"
	"context"
	"fmt"
	"math"
	"reflect"
	"strconv"
	"strings"
	"time"
)

type Engine struct{}

func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Evaluate(ctx context.Context, conditions []models.Condition, variables map[string]interface{}) (bool, error) {
	if len(conditions) == 0 {
		return true, nil
	}

	for _, cond := range conditions {
		result, err := e.evaluateSingle(ctx, cond, variables)
		if err != nil {
			return false, err
		}
		if !result {
			return false, nil
		}
	}
	return true, nil
}

func (e *Engine) evaluateSingle(ctx context.Context, cond models.Condition, variables map[string]interface{}) (bool, error) {
	switch cond.Type {
	case models.ConditionAmount:
		return e.evaluateAmount(cond, variables)
	case models.ConditionTime:
		return e.evaluateTime(cond)
	case models.ConditionVariable:
		return e.evaluateVariable(cond, variables)
	case models.ConditionExpression:
		return e.evaluateExpression(cond, variables)
	default:
		return false, fmt.Errorf("unknown condition type: %s", cond.Type)
	}
}

func (e *Engine) evaluateAmount(cond models.Condition, variables map[string]interface{}) (bool, error) {
	actual, ok := variables[cond.Field]
	if !ok {
		return false, fmt.Errorf("required variable %q not found in flow instance variables", cond.Field)
	}

	actualFloat, err := toFloat64(actual)
	if err != nil {
		return false, fmt.Errorf("variable %q value %v cannot be converted to number: %v", cond.Field, actual, err)
	}

	threshold, err := toFloat64(cond.Value)
	if err != nil {
		return false, fmt.Errorf("invalid threshold value: %v", err)
	}

	return e.compareFloat64(cond.Operator, actualFloat, threshold)
}

func (e *Engine) evaluateTime(cond models.Condition) (bool, error) {
	now := time.Now()
	thresholdTime, ok := cond.Value.(time.Time)
	if !ok {
		strTime, ok := cond.Value.(string)
		if !ok {
			return false, fmt.Errorf("invalid time value type")
		}
		var err error
		thresholdTime, err = time.Parse(time.RFC3339, strTime)
		if err != nil {
			thresholdTime, err = time.Parse("2006-01-02", strTime)
			if err != nil {
				return false, fmt.Errorf("invalid time format: %v", err)
			}
		}
	}

	switch cond.Operator {
	case models.OpGt:
		return now.After(thresholdTime), nil
	case models.OpGte:
		return now.After(thresholdTime) || now.Equal(thresholdTime), nil
	case models.OpLt:
		return now.Before(thresholdTime), nil
	case models.OpLte:
		return now.Before(thresholdTime) || now.Equal(thresholdTime), nil
	default:
		return false, fmt.Errorf("unsupported operator %s for time condition", cond.Operator)
	}
}

func (e *Engine) evaluateVariable(cond models.Condition, variables map[string]interface{}) (bool, error) {
	actual, ok := variables[cond.Field]
	if !ok {
		return false, fmt.Errorf("required variable %q not found in flow instance variables", cond.Field)
	}

	return e.compare(cond.Operator, actual, cond.Value)
}

func (e *Engine) evaluateExpression(cond models.Condition, variables map[string]interface{}) (bool, error) {
	if cond.Expression == "" {
		return true, nil
	}
	result, err := e.evalSimpleExpr(cond.Expression, variables)
	if err != nil {
		return false, fmt.Errorf("expression evaluation failed: %v", err)
	}
	return result, nil
}

func (e *Engine) evalSimpleExpr(expr string, variables map[string]interface{}) (bool, error) {
	expr = strings.TrimSpace(expr)
	if expr == "" {
		return true, nil
	}

	expr = strings.ReplaceAll(expr, "&&", "AND")
	expr = strings.ReplaceAll(expr, "||", "OR")

	return e.evalLogicalExpr(expr, variables)
}

func (e *Engine) evalLogicalExpr(expr string, variables map[string]interface{}) (bool, error) {
	level := 0
	orIdx := -1
	for i, c := range expr {
		switch c {
		case '(':
			level++
		case ')':
			level--
		}
		if level == 0 && i+2 < len(expr) && expr[i:i+2] == "OR" {
			orIdx = i
			break
		}
	}

	if orIdx != -1 {
		left := strings.TrimSpace(expr[:orIdx])
		right := strings.TrimSpace(expr[orIdx+2:])
		lVal, err := e.evalLogicalExpr(left, variables)
		if err != nil {
			return false, err
		}
		if lVal {
			return true, nil
		}
		rVal, err := e.evalLogicalExpr(right, variables)
		if err != nil {
			return false, err
		}
		return rVal, nil
	}

	level = 0
	andIdx := -1
	for i, c := range expr {
		switch c {
		case '(':
			level++
		case ')':
			level--
		}
		if level == 0 && i+3 < len(expr) && expr[i:i+3] == "AND" {
			andIdx = i
			break
		}
	}

	if andIdx != -1 {
		left := strings.TrimSpace(expr[:andIdx])
		right := strings.TrimSpace(expr[andIdx+3:])
		lVal, err := e.evalLogicalExpr(left, variables)
		if err != nil {
			return false, err
		}
		if !lVal {
			return false, nil
		}
		rVal, err := e.evalLogicalExpr(right, variables)
		if err != nil {
			return false, err
		}
		return rVal, nil
	}

	if strings.HasPrefix(expr, "(") && strings.HasSuffix(expr, ")") {
		return e.evalLogicalExpr(strings.TrimSpace(expr[1:len(expr)-1]), variables)
	}

	return e.evalComparison(expr, variables)
}

func (e *Engine) evalComparison(expr string, variables map[string]interface{}) (bool, error) {
	type opEntry struct {
		sym  string
		slen int
	}
	ops := []opEntry{
		{">=", 2}, {"<=", 2}, {"!=", 2}, {"==", 2},
		{">", 1}, {"<", 1},
	}

	for _, entry := range ops {
		idx := findOperatorIndex(expr, entry.sym)
		if idx != -1 {
			left := strings.TrimSpace(expr[:idx])
			right := strings.TrimSpace(expr[idx+entry.slen:])
			if left == "" || right == "" {
				continue
			}
			lVal, err := e.evalValue(left, variables)
			if err != nil {
				return false, err
			}
			rVal, err := e.evalValue(right, variables)
			if err != nil {
				return false, err
			}
			return e.compareAny(entry.sym, lVal, rVal)
		}
	}
	return false, fmt.Errorf("invalid comparison expression: %s", expr)
}

func findOperatorIndex(expr, op string) int {
	inString := false
	stringChar := byte(0)
	for i := 0; i < len(expr); i++ {
		c := expr[i]
		if inString {
			if c == stringChar {
				inString = false
			}
			continue
		}
		if c == '"' || c == '\'' {
			inString = true
			stringChar = c
			continue
		}
		if i+len(op) <= len(expr) && expr[i:i+len(op)] == op {
			if len(op) == 1 && i+1 < len(expr) && (expr[i+1] == '=' || expr[i] == '!' && i+1 < len(expr) && expr[i+1] == '=') {
				continue
			}
			if len(op) == 1 && i > 0 && (expr[i-1] == '>' || expr[i-1] == '<' || expr[i-1] == '!' || expr[i-1] == '=') {
				continue
			}
			return i
		}
	}
	return -1
}

func (e *Engine) evalValue(expr string, variables map[string]interface{}) (interface{}, error) {
	expr = strings.TrimSpace(expr)

	if strings.HasPrefix(expr, "\"") && strings.HasSuffix(expr, "\"") {
		return expr[1 : len(expr)-1], nil
	}
	if strings.HasPrefix(expr, "'") && strings.HasSuffix(expr, "'") {
		return expr[1 : len(expr)-1], nil
	}

	if val, ok := variables[expr]; ok {
		return val, nil
	}

	if f, err := strconv.ParseFloat(expr, 64); err == nil {
		return f, nil
	}

	if expr == "true" {
		return true, nil
	}
	if expr == "false" {
		return false, nil
	}

	return expr, nil
}

func (e *Engine) compareAny(op string, a, b interface{}) (bool, error) {
	aFloat, aErr := toFloat64(a)
	bFloat, bErr := toFloat64(b)

	if aErr == nil && bErr == nil {
		return e.compareFloatOp(op, aFloat, bFloat)
	}

	aStr := fmt.Sprintf("%v", a)
	bStr := fmt.Sprintf("%v", b)

	switch op {
	case "==":
		return aStr == bStr, nil
	case "!=":
		return aStr != bStr, nil
	}

	return false, fmt.Errorf("cannot compare values: %v %s %v", a, op, b)
}

const floatEpsilon = 1e-9

func (e *Engine) compareFloatOp(op string, a, b float64) (bool, error) {
	switch op {
	case "==":
		return math.Abs(a-b) < floatEpsilon, nil
	case "!=":
		return math.Abs(a-b) >= floatEpsilon, nil
	case ">":
		return a-b > floatEpsilon, nil
	case ">=":
		return a-b > -floatEpsilon, nil
	case "<":
		return b-a > floatEpsilon, nil
	case "<=":
		return b-a > -floatEpsilon, nil
	default:
		return false, fmt.Errorf("unsupported operator: %s", op)
	}
}

func (e *Engine) compare(op models.Operator, a, b interface{}) (bool, error) {
	aFloat, aErr := toFloat64(a)
	bFloat, bErr := toFloat64(b)

	if aErr == nil && bErr == nil {
		return e.compareFloat64(op, aFloat, bFloat)
	}

	aStr := fmt.Sprintf("%v", a)
	bStr := fmt.Sprintf("%v", b)

	switch op {
	case models.OpEq:
		return aStr == bStr, nil
	case models.OpNe:
		return aStr != bStr, nil
	default:
		return false, fmt.Errorf("unsupported operator %s for string comparison", op)
	}
}

func (e *Engine) compareFloat64(op models.Operator, a, b float64) (bool, error) {
	switch op {
	case models.OpEq:
		return math.Abs(a-b) < floatEpsilon, nil
	case models.OpNe:
		return math.Abs(a-b) >= floatEpsilon, nil
	case models.OpGt:
		return a-b > floatEpsilon, nil
	case models.OpGte:
		return a-b > -floatEpsilon, nil
	case models.OpLt:
		return b-a > floatEpsilon, nil
	case models.OpLte:
		return b-a > -floatEpsilon, nil
	default:
		return false, fmt.Errorf("unsupported operator: %s", op)
	}
}

func toFloat64(v interface{}) (float64, error) {
	switch val := v.(type) {
	case float64:
		return val, nil
	case float32:
		return float64(val), nil
	case int:
		return float64(val), nil
	case int64:
		return float64(val), nil
	case int32:
		return float64(val), nil
	case string:
		var f float64
		_, err := fmt.Sscanf(val, "%f", &f)
		return f, err
	default:
		return 0, fmt.Errorf("cannot convert %v to float64", reflect.TypeOf(v))
	}
}
