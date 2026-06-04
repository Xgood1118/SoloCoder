package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/solocoder/taskscheduler/internal/api"
	"github.com/solocoder/taskscheduler/internal/config"
	"github.com/solocoder/taskscheduler/internal/dependency"
	"github.com/solocoder/taskscheduler/internal/dlq"
	"github.com/solocoder/taskscheduler/internal/models"
	"github.com/solocoder/taskscheduler/internal/notifier"
	"github.com/solocoder/taskscheduler/internal/output"
	"github.com/solocoder/taskscheduler/internal/queue"
	"github.com/solocoder/taskscheduler/internal/retry"
	"github.com/solocoder/taskscheduler/internal/scheduler"
	"github.com/solocoder/taskscheduler/internal/store"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := config.DefaultConfig()
	if len(os.Args) > 1 {
		loadedCfg, err := config.LoadConfig(os.Args[1])
		if err != nil {
			log.Printf("Warning: failed to load config file, using default config: %v", err)
		} else {
			cfg = loadedCfg
		}
	}

	if err := cfg.Validate(); err != nil {
		log.Fatalf("Invalid config: %v", err)
	}

	dsn := cfg.DB.DSN + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)"
	baseDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
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
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get database instance: %v", err)
	}
	sqlDB.SetMaxOpenConns(cfg.DB.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.DB.MaxIdleConns)

	str := store.NewStore(db)
	if err := str.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run auto migration: %v", err)
	}

	q := queue.NewMemoryQueue(cfg.QueueSize)

	retryManager := retry.NewRetryManager(&cfg.Retry)
	retryManager.SetStore(str)

	notifierMgr := notifier.NewAlertManager()
	notifierMgr.AddNotifier("console", notifier.NewConsoleNotifier())
	if cfg.Alert.Enabled && cfg.Alert.Webhook != "" {
		notifierMgr.AddNotifier("webhook", notifier.NewWebhookNotifier(cfg.Alert.Webhook))
	}

	depChecker := dependency.NewDefaultDependencyChecker(str)

	outputMgr := output.NewOutputManager()

	dlqMgr := dlq.NewDeadLetterManager(str, db)
	dlqMgr.SetNotifier(dlq.NewConsoleAlertNotifier())

	schedCfg := &scheduler.SchedulerConfig{
		Config:            cfg,
		Store:             str,
		Queue:             q,
		RetryManager:      retryManager,
		DLQManager:        dlqMgr,
		DependencyChecker: depChecker,
		OutputManager:     outputMgr,
		Notifier:          notifierMgr,
		DB:                db,
	}

	sched, err := scheduler.NewScheduler(schedCfg)
	if err != nil {
		log.Fatalf("Failed to create scheduler: %v", err)
	}

	registerTaskHandlers(sched)

	registerOutputs(outputMgr)

	if err := sched.Start(ctx); err != nil {
		log.Fatalf("Failed to start scheduler: %v", err)
	}
	log.Println("Scheduler started successfully")

	apiServer := api.NewAPIServer(sched, ":8101")
	if err := apiServer.Start(ctx); err != nil {
		log.Fatalf("Failed to start API server: %v", err)
	}
	log.Println("API server started on :8101")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh
	log.Printf("Received signal: %v, shutting down gracefully...", sig)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := apiServer.Stop(shutdownCtx); err != nil {
		log.Printf("Error stopping API server: %v", err)
	}
	log.Println("API server stopped")

	if err := sched.Stop(shutdownCtx); err != nil {
		log.Printf("Error stopping scheduler: %v", err)
	}
	log.Println("Scheduler stopped")

	if err := q.Close(); err != nil {
		log.Printf("Error closing queue: %v", err)
	}
	log.Println("Queue closed")

	log.Println("Graceful shutdown completed")
}

func registerTaskHandlers(sched *scheduler.Scheduler) {
	sched.RegisterTaskHandler("data_sync", func(ctx context.Context, job *models.Job) (string, error) {
		log.Printf("Executing data sync job: %s, payload: %s", job.Name, job.Payload)
		time.Sleep(2 * time.Second)
		return fmt.Sprintf("Data sync completed for job %s", job.Name), nil
	})

	sched.RegisterTaskHandler("report_generate", func(ctx context.Context, job *models.Job) (string, error) {
		log.Printf("Executing report generate job: %s, payload: %s", job.Name, job.Payload)
		time.Sleep(3 * time.Second)
		return fmt.Sprintf("Report generated for job %s", job.Name), nil
	})

	sched.RegisterTaskHandler("batch_process", func(ctx context.Context, job *models.Job) (string, error) {
		log.Printf("Executing batch process job: %s, payload: %s", job.Name, job.Payload)
		time.Sleep(5 * time.Second)
		return fmt.Sprintf("Batch processing completed for job %s", job.Name), nil
	})

	log.Println("Registered task handlers: data_sync, report_generate, batch_process")
}

func registerOutputs(outputMgr output.OutputManager) {
	outputMgr.AddOutput(&output.OutputConfig{
		Type:        output.OutputTypeCallback,
		CallbackURL: "http://localhost:8101/webhook",
		Timeout:     10 * time.Second,
		RetryCount:  3,
	})

	outputMgr.AddOutput(&output.OutputConfig{
		Type:      output.OutputTypeQueue,
		QueueName: "job_results",
	})

	log.Println("Registered outputs: callback, queue")
}
