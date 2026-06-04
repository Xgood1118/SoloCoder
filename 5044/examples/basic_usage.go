package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/solocoder/taskscheduler/internal/config"
	"github.com/solocoder/taskscheduler/internal/cron"
	"github.com/solocoder/taskscheduler/internal/dependency"
	"github.com/solocoder/taskscheduler/internal/models"
	"github.com/solocoder/taskscheduler/internal/notifier"
	"github.com/solocoder/taskscheduler/internal/queue"
	"github.com/solocoder/taskscheduler/internal/scheduler"
	"github.com/solocoder/taskscheduler/internal/store"
)

type SchedulerWithMode struct {
	*scheduler.Scheduler
	cronParser *cron.CronParser
}

func NewSchedulerWithMode(cfg *scheduler.SchedulerConfig, mode cron.CronMode) (*SchedulerWithMode, error) {
	s, err := scheduler.NewScheduler(cfg)
	if err != nil {
		return nil, err
	}
	return &SchedulerWithMode{
		Scheduler:  s,
		cronParser: cron.NewCronParser(mode),
	}, nil
}

func (s *SchedulerWithMode) ScheduleJobWithMode(ctx context.Context, job *models.Job) error {
	if job.CronExpr != "" {
		cronExpr, err := s.cronParser.Parse(job.CronExpr)
		if err != nil {
			return fmt.Errorf("parse cron expression failed: %w", err)
		}
		job.NextExecuteTime = cronExpr.Next(time.Now())
	}
	return s.Scheduler.ScheduleJob(ctx, job)
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := config.DefaultConfig()
	cfg.DB.DSN = "example_scheduler.db"
	cfg.WorkerCount = 3
	cfg.QueueSize = 100
	cfg.Node.NodeID = "example-node-1"
	cfg.Node.NodeName = "示例节点"

	dsn := cfg.DB.DSN + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)"
	baseDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatalf("打开数据库失败: %v", err)
	}

	db, err := gorm.Open(&store.SQLite{
		DSN:  dsn,
		Conn: baseDB,
	}, &gorm.Config{
		SkipDefaultTransaction: true,
		Logger: logger.New(
			log.New(os.Stdout, "\r\n", log.LstdFlags),
			logger.Config{
				SlowThreshold:             time.Second,
				LogLevel:                  logger.Error,
				IgnoreRecordNotFoundError: true,
				Colorful:                  false,
			},
		),
	})
	if err != nil {
		log.Fatalf("打开数据库失败: %v", err)
	}

	jobStore := store.NewStore(db)
	if err := jobStore.AutoMigrate(); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	taskQueue := queue.NewMemoryQueue(cfg.QueueSize)

	alertManager := notifier.NewAlertManager()
	alertManager.AddNotifier("console", notifier.NewConsoleNotifier())

	schedulerCfg := &scheduler.SchedulerConfig{
		Config:   cfg,
		Store:    jobStore,
		Queue:    taskQueue,
		Notifier: alertManager,
		DB:       db,
	}

	standardScheduler, err := NewSchedulerWithMode(schedulerCfg, cron.ModeStandard)
	if err != nil {
		log.Fatalf("创建标准模式调度器失败: %v", err)
	}

	standardScheduler.RegisterTaskHandler("data_sync", func(ctx context.Context, job *models.Job) (string, error) {
		log.Printf("[%s] 执行数据同步任务: %s", time.Now().Format("15:04:05"), job.Name)
		return fmt.Sprintf("数据同步完成, 处理记录数: %d", 100+job.ExecuteTimes), nil
	})

	standardScheduler.RegisterTaskHandler("report_generate", func(ctx context.Context, job *models.Job) (string, error) {
		log.Printf("[%s] 执行报表生成任务: %s", time.Now().Format("15:04:05"), job.Name)
		return fmt.Sprintf("报表生成成功, 文件: report_%d.pdf", time.Now().Unix()), nil
	})

	standardScheduler.RegisterTaskHandler("batch_process", func(ctx context.Context, job *models.Job) (string, error) {
		log.Printf("[%s] 执行批处理任务: %s, 依赖数据已就绪", time.Now().Format("15:04:05"), job.Name)
		return "批处理完成", nil
	})

	if err := standardScheduler.Start(ctx); err != nil {
		log.Fatalf("启动调度器失败: %v", err)
	}
	log.Println("调度器已启动")

	job1 := &models.Job{
		Name:     "每秒数据同步",
		Type:     "data_sync",
		CronExpr: "* * * * * *",
		CronMode: models.CronModeStandard,
		MaxRetries: 3,
	}
	if err := standardScheduler.ScheduleJobWithMode(ctx, job1); err != nil {
		log.Fatalf("调度每秒任务失败: %v", err)
	}
	log.Printf("已调度每秒任务: %s (ID: %s), 下次执行: %s", job1.Name, job1.ID, job1.NextExecuteTime.Format("15:04:05"))

	extendedScheduler, err := NewSchedulerWithMode(schedulerCfg, cron.ModeExtended)
	if err != nil {
		log.Fatalf("创建扩展模式调度器失败: %v", err)
	}

	job2 := &models.Job{
		Name:     "年度报表生成",
		Type:     "report_generate",
		CronExpr: "0 0 0 1 1 * 2026",
		CronMode: models.CronModeExtended,
		MaxRetries: 3,
	}
	if err := extendedScheduler.ScheduleJobWithMode(ctx, job2); err != nil {
		log.Fatalf("调度年度任务失败: %v", err)
	}
	log.Printf("已调度年度报表任务: %s (ID: %s), 下次执行: %s", job2.Name, job2.ID, job2.NextExecuteTime.Format("2006-01-02 15:04:05"))

	deps := []dependency.DependencyConfig{
		{
			Type:    dependency.DependencyTypeJob,
			JobName: "每秒数据同步",
		},
	}
	depsJSON, _ := json.Marshal(deps)

	job3 := &models.Job{
		Name:         "依赖数据同步的批处理",
		Type:         "batch_process",
		CronExpr:     "*/5 * * * * *",
		CronMode:     models.CronModeStandard,
		Dependencies: string(depsJSON),
		MaxRetries:   3,
	}
	if err := standardScheduler.ScheduleJobWithMode(ctx, job3); err != nil {
		log.Fatalf("调度依赖任务失败: %v", err)
	}
	log.Printf("已调度依赖任务: %s (ID: %s), 下次执行: %s", job3.Name, job3.ID, job3.NextExecuteTime.Format("15:04:05"))
	log.Println("按 Ctrl+C 停止调度器...")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	timer := time.NewTimer(10 * time.Second)
	select {
	case <-sigCh:
		log.Println("收到停止信号")
	case <-timer.C:
		log.Println("示例运行10秒后自动停止")
	}

	log.Println("正在停止调度器...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := standardScheduler.Stop(shutdownCtx); err != nil {
		log.Printf("停止调度器失败: %v", err)
	} else {
		log.Println("调度器已成功停止")
	}

	jobs, _ := jobStore.ListJobs(ctx)
	log.Printf("当前共有 %d 个任务:", len(jobs))
	for _, j := range jobs {
		log.Printf("  - %s (类型: %s, 状态: %s, 执行次数: %d)", j.Name, j.Type, j.Status, j.ExecuteTimes)
	}
}
