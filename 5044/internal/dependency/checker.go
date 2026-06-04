package dependency

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/solocoder/taskscheduler/internal/models"
	"github.com/solocoder/taskscheduler/internal/store"
)

var (
	ErrDependencyNotMet  = errors.New("dependency not met")
	ErrInvalidDependency = errors.New("invalid dependency configuration")
	ErrTimeout           = errors.New("timeout waiting for dependencies")
)

type DependencyType string

const (
	DependencyTypeJob      DependencyType = "job"
	DependencyTypeFile     DependencyType = "file"
	DependencyTypeCustom   DependencyType = "custom"
)

type DependencyConfig struct {
	Type      DependencyType `json:"type"`
	JobID     string         `json:"job_id,omitempty"`
	JobName   string         `json:"job_name,omitempty"`
	FilePath  string         `json:"file_path,omitempty"`
	Condition string         `json:"condition,omitempty"`
	Params    map[string]interface{} `json:"params,omitempty"`
}

type DependencyCondition interface {
	Check(ctx context.Context, job *models.Job, params map[string]interface{}) (bool, error)
	Name() string
}

type EnhancedDependencyChecker interface {
	DependencyChecker
	WaitForDependencies(ctx context.Context, job *models.Job, timeout time.Duration) (bool, error)
	RegisterCondition(condition DependencyCondition)
}

type DefaultDependencyChecker struct {
	store      store.Store
	conditions map[string]DependencyCondition
}

func NewDefaultDependencyChecker(s store.Store) *DefaultDependencyChecker {
	checker := &DefaultDependencyChecker{
		store:      s,
		conditions: make(map[string]DependencyCondition),
	}
	checker.registerBuiltinConditions()
	return checker
}

func (c *DefaultDependencyChecker) registerBuiltinConditions() {
	c.RegisterCondition(&FileExistsCondition{})
}

func (c *DefaultDependencyChecker) RegisterCondition(condition DependencyCondition) {
	c.conditions[condition.Name()] = condition
}

func (c *DefaultDependencyChecker) CheckDependencies(ctx context.Context, job *models.Job) (bool, error) {
	if job.Dependencies == "" {
		return true, nil
	}

	deps, err := parseDependencies(job.Dependencies)
	if err != nil {
		return c.checkLegacyDependencies(ctx, job)
	}

	for _, dep := range deps {
		met, err := c.checkDependency(ctx, job, dep)
		if err != nil {
			return false, err
		}
		if !met {
			return false, nil
		}
	}

	return true, nil
}

func (c *DefaultDependencyChecker) GetUnmetDependencies(ctx context.Context, job *models.Job) ([]string, error) {
	if job.Dependencies == "" {
		return nil, nil
	}

	deps, err := parseDependencies(job.Dependencies)
	if err != nil {
		return c.getLegacyUnmetDependencies(ctx, job)
	}

	var unmet []string
	for _, dep := range deps {
		met, err := c.checkDependency(ctx, job, dep)
		if err != nil {
			unmet = append(unmet, fmt.Sprintf("%s: %v", dep.Type, err))
			continue
		}
		if !met {
			switch dep.Type {
			case DependencyTypeJob:
				unmet = append(unmet, fmt.Sprintf("job %s: not completed", dep.JobID))
			case DependencyTypeFile:
				unmet = append(unmet, fmt.Sprintf("file %s: not exists", dep.FilePath))
			case DependencyTypeCustom:
				unmet = append(unmet, fmt.Sprintf("custom %s: not met", dep.Condition))
			}
		}
	}

	return unmet, nil
}

func (c *DefaultDependencyChecker) checkLegacyDependencies(ctx context.Context, job *models.Job) (bool, error) {
	legacyDeps, err := parseLegacyDependencies(job.Dependencies)
	if err != nil {
		return false, err
	}

	for _, dep := range legacyDeps {
		depJob, err := c.store.GetJob(ctx, dep.JobID)
		if err != nil {
			return false, nil
		}

		requiredStatus := dep.Status
		if requiredStatus == "" {
			requiredStatus = string(models.JobStatusCompleted)
		}

		if string(depJob.Status) != requiredStatus {
			return false, nil
		}
	}

	return true, nil
}

func (c *DefaultDependencyChecker) getLegacyUnmetDependencies(ctx context.Context, job *models.Job) ([]string, error) {
	legacyDeps, err := parseLegacyDependencies(job.Dependencies)
	if err != nil {
		return nil, err
	}

	var unmet []string
	for _, dep := range legacyDeps {
		depJob, err := c.store.GetJob(ctx, dep.JobID)
		if err != nil {
			unmet = append(unmet, dep.JobID+": not found")
			continue
		}

		requiredStatus := dep.Status
		if requiredStatus == "" {
			requiredStatus = string(models.JobStatusCompleted)
		}

		if string(depJob.Status) != requiredStatus {
			unmet = append(unmet, dep.JobID+": expected "+requiredStatus+", got "+string(depJob.Status))
		}
	}

	return unmet, nil
}

type legacyJobDependency struct {
	JobID     string `json:"job_id"`
	Status    string `json:"status,omitempty"`
	Condition string `json:"condition,omitempty"`
}

func parseLegacyDependencies(depsStr string) ([]legacyJobDependency, error) {
	depsStr = strings.TrimSpace(depsStr)
	if depsStr == "" {
		return nil, nil
	}

	var deps []legacyJobDependency

	if strings.HasPrefix(depsStr, "[") {
		if err := json.Unmarshal([]byte(depsStr), &deps); err == nil {
			return deps, nil
		}
	}

	jobIDs := strings.Split(depsStr, ",")
	for _, id := range jobIDs {
		id = strings.TrimSpace(id)
		if id != "" {
			deps = append(deps, legacyJobDependency{JobID: id})
		}
	}

	return deps, nil
}

func (c *DefaultDependencyChecker) WaitForDependencies(ctx context.Context, job *models.Job, timeout time.Duration) (bool, error) {
	if timeout <= 0 {
		return c.CheckDependencies(ctx, job)
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return false, ErrTimeout
			}
			return false, ctx.Err()
		case <-ticker.C:
			met, err := c.CheckDependencies(ctx, job)
			if err != nil && !errors.Is(err, ErrDependencyNotMet) {
				return false, err
			}
			if met {
				return true, nil
			}
		}
	}
}

func (c *DefaultDependencyChecker) checkDependency(ctx context.Context, job *models.Job, dep DependencyConfig) (bool, error) {
	switch dep.Type {
	case DependencyTypeJob:
		return c.checkJobDependency(ctx, dep)
	case DependencyTypeFile:
		return c.checkFileDependency(dep)
	case DependencyTypeCustom:
		return c.checkCustomDependency(ctx, job, dep)
	default:
		return false, fmt.Errorf("%w: unknown type %s", ErrInvalidDependency, dep.Type)
	}
}

func (c *DefaultDependencyChecker) checkJobDependency(ctx context.Context, dep DependencyConfig) (bool, error) {
	var depJob *models.Job
	var err error

	if dep.JobID != "" {
		depJob, err = c.store.GetJob(ctx, dep.JobID)
		if err != nil {
			return false, fmt.Errorf("failed to get dependent job %s: %w", dep.JobID, err)
		}
	} else if dep.JobName != "" {
		jobs, err := c.store.ListJobs(ctx)
		if err != nil {
			return false, fmt.Errorf("failed to list jobs: %w", err)
		}
		for _, j := range jobs {
			if j.Name == dep.JobName {
				depJob = j
				break
			}
		}
		if depJob == nil {
			return false, fmt.Errorf("dependent job not found: %s", dep.JobName)
		}
	} else {
		return false, fmt.Errorf("%w: job dependency must have job_id or job_name", ErrInvalidDependency)
	}

	return depJob.Status == models.JobStatusCompleted, nil
}

func (c *DefaultDependencyChecker) checkFileDependency(dep DependencyConfig) (bool, error) {
	if dep.FilePath == "" {
		return false, fmt.Errorf("%w: file dependency must have file_path", ErrInvalidDependency)
	}

	_, err := os.Stat(dep.FilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to check file %s: %w", dep.FilePath, err)
	}

	return true, nil
}

func (c *DefaultDependencyChecker) checkCustomDependency(ctx context.Context, job *models.Job, dep DependencyConfig) (bool, error) {
	if dep.Condition == "" {
		return false, fmt.Errorf("%w: custom dependency must have condition name", ErrInvalidDependency)
	}

	condition, ok := c.conditions[dep.Condition]
	if !ok {
		return false, fmt.Errorf("custom condition not registered: %s", dep.Condition)
	}

	return condition.Check(ctx, job, dep.Params)
}

func parseDependencies(depsStr string) ([]DependencyConfig, error) {
	depsStr = strings.TrimSpace(depsStr)
	if depsStr == "" {
		return nil, nil
	}

	var deps []DependencyConfig
	if err := json.Unmarshal([]byte(depsStr), &deps); err != nil {
		return nil, err
	}

	return deps, nil
}

type FileExistsCondition struct{}

func (c *FileExistsCondition) Name() string {
	return "file_exists"
}

func (c *FileExistsCondition) Check(ctx context.Context, job *models.Job, params map[string]interface{}) (bool, error) {
	path, ok := params["path"].(string)
	if !ok {
		return false, fmt.Errorf("file_exists condition requires 'path' parameter")
	}

	_, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}
