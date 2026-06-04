package dependency

import (
	"context"

	"github.com/solocoder/taskscheduler/internal/models"
)

type DependencyChecker interface {
	CheckDependencies(ctx context.Context, job *models.Job) (bool, error)
	GetUnmetDependencies(ctx context.Context, job *models.Job) ([]string, error)
}
