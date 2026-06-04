package condition

import (
	"approval-flow/internal/models"
	"context"
	"testing"
)

func TestEvaluateAmount_MissingVariable_ReturnsError(t *testing.T) {
	e := NewEngine()
	conds := []models.Condition{
		{Type: models.ConditionAmount, Field: "amount", Operator: models.OpGt, Value: 1000.0},
	}
	_, err := e.Evaluate(context.Background(), conds, map[string]interface{}{})
	if err == nil {
		t.Fatal("expected error when variable is missing, got nil")
	}
	if got := err.Error(); got == "" {
		t.Fatal("expected non-empty error message")
	}
}

func TestEvaluateAmount_PresentVariable(t *testing.T) {
	e := NewEngine()
	conds := []models.Condition{
		{Type: models.ConditionAmount, Field: "amount", Operator: models.OpGt, Value: 1000.0},
	}
	ok, err := e.Evaluate(context.Background(), conds, map[string]interface{}{"amount": 5000.0})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Fatal("expected true, got false")
	}
}

func TestEvaluateVariable_MissingVariable_ReturnsError(t *testing.T) {
	e := NewEngine()
	conds := []models.Condition{
		{Type: models.ConditionVariable, Field: "department", Operator: models.OpEq, Value: "IT"},
	}
	_, err := e.Evaluate(context.Background(), conds, map[string]interface{}{})
	if err == nil {
		t.Fatal("expected error when variable is missing, got nil")
	}
}

func TestExpressionComparison(t *testing.T) {
	e := NewEngine()
	vars := map[string]interface{}{"x": 9999.0}

	tests := []struct {
		expr string
		want bool
	}{
		{"x>0", true},
		{"x<0", false},
		{"x>=9999", true},
		{"x<=9999", true},
		{"x==9999", true},
		{"x!=9999", false},
		{"x>10000", false},
		{"x<10000", true},
	}

	for _, tt := range tests {
		conds := []models.Condition{
			{Type: models.ConditionExpression, Expression: tt.expr},
		}
		ok, err := e.Evaluate(context.Background(), conds, vars)
		if err != nil {
			t.Errorf("expr %q: unexpected error: %v", tt.expr, err)
			continue
		}
		if ok != tt.want {
			t.Errorf("expr %q: got %v, want %v", tt.expr, ok, tt.want)
		}
	}
}

func TestExpressionFloatPrecision(t *testing.T) {
	e := NewEngine()
	vars := map[string]interface{}{"x": 0.1 + 0.2}

	conds := []models.Condition{
		{Type: models.ConditionExpression, Expression: "x==0.3"},
	}
	ok, err := e.Evaluate(context.Background(), conds, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected 0.1+0.2 == 0.3 with epsilon tolerance, got false")
	}
}

func TestExpressionNegativeValue(t *testing.T) {
	e := NewEngine()
	vars := map[string]interface{}{"x": -5.0}

	conds := []models.Condition{
		{Type: models.ConditionExpression, Expression: "x<=0"},
	}
	ok, err := e.Evaluate(context.Background(), conds, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected -5 <= 0 to be true")
	}
}

func TestExpressionLogicalOperators(t *testing.T) {
	e := NewEngine()
	vars := map[string]interface{}{"x": 5.0, "y": 10.0}

	conds := []models.Condition{
		{Type: models.ConditionExpression, Expression: "x>0 AND y>0"},
	}
	ok, err := e.Evaluate(context.Background(), conds, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected x>0 AND y>0 to be true")
	}

	conds2 := []models.Condition{
		{Type: models.ConditionExpression, Expression: "x<0 OR y>0"},
	}
	ok2, err2 := e.Evaluate(context.Background(), conds2, vars)
	if err2 != nil {
		t.Fatalf("unexpected error: %v", err2)
	}
	if !ok2 {
		t.Error("expected x<0 OR y>0 to be true")
	}
}

func TestExpressionOperatorNotConfused(t *testing.T) {
	e := NewEngine()
	vars := map[string]interface{}{"x": 5.0}

	conds := []models.Condition{
		{Type: models.ConditionExpression, Expression: "x==5"},
	}
	ok, err := e.Evaluate(context.Background(), conds, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected x==5 to be true, operator == should not be confused with =")
	}
}

func TestNoConditions_ReturnsTrue(t *testing.T) {
	e := NewEngine()
	ok, err := e.Evaluate(context.Background(), nil, map[string]interface{}{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected true for empty conditions")
	}
}

func TestFloatComparisonWithEpsilon(t *testing.T) {
	e := NewEngine()

	conds := []models.Condition{
		{Type: models.ConditionAmount, Field: "amount", Operator: models.OpEq, Value: 0.3},
	}
	vars := map[string]interface{}{"amount": 0.1 + 0.2}
	ok, err := e.Evaluate(context.Background(), conds, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected 0.1+0.2 == 0.3 with epsilon tolerance")
	}
}
