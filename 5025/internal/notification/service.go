package notification

import (
	"approval-flow/internal/models"
	"context"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"sync"
)

type Message struct {
	ID        string
	UserID    string
	Title     string
	Content   string
	Channel   models.NotificationChannel
	Read      bool
	CreatedAt int64
}

type NotificationService struct {
	inAppMessages   map[string][]*Message
	userPreferences map[string]models.NotificationChannel
	userEmails      map[string]string
	mu                sync.RWMutex
	emailSender       EmailSender
}

type EmailSender interface {
	Send(to, subject, body string) error
}

type ConsoleEmailSender struct{}

func (s *ConsoleEmailSender) Send(to, subject, body string) error {
	log.Printf("[EMAIL] To: %s, Subject: %s, Body: %s", to, subject, body)
	return nil
}

type SMTPEmailSender struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

func (s *SMTPEmailSender) Send(to, subject, body string) error {
	if s.Host == "" {
		log.Printf("[SMTP DISABLED] To: %s, Subject: %s", to, subject)
		return nil
	}

	auth := smtp.PlainAuth("", s.Username, s.Password, s.Host)
	
	msg := []byte("From: " + s.From + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
		body + "\r\n")

	addr := s.Host + ":" + s.Port
	return smtp.SendMail(addr, auth, s.From, []string{to}, msg)
}

func NewNotificationService() *NotificationService {
	var sender EmailSender
	
	smtpHost := os.Getenv("SMTP_HOST")
	if smtpHost != "" {
		sender = &SMTPEmailSender{
			Host:     smtpHost,
			Port:     getEnvOrDefault("SMTP_PORT", "587"),
			Username: os.Getenv("SMTP_USERNAME"),
			Password: os.Getenv("SMTP_PASSWORD"),
			From:     getEnvOrDefault("SMTP_FROM", os.Getenv("SMTP_USERNAME")),
		}
	} else {
		sender = &ConsoleEmailSender{}
	}
	
	return &NotificationService{
		inAppMessages:   make(map[string][]*Message),
		userPreferences: make(map[string]models.NotificationChannel),
		userEmails:      make(map[string]string),
		emailSender:     sender,
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func (s *NotificationService) SetUserEmail(userID, email string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.userEmails[userID] = email
}

func (s *NotificationService) GetUserEmail(userID string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if email, ok := s.userEmails[userID]; ok {
		return email
	}
	return userID
}

func (s *NotificationService) SetUserPreference(userID string, channel models.NotificationChannel) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.userPreferences[userID] = channel
}

func (s *NotificationService) GetUserPreference(userID string) models.NotificationChannel {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if pref, ok := s.userPreferences[userID]; ok {
		return pref
	}
	return models.ChannelInApp
}

func (s *NotificationService) Send(ctx context.Context, userID, title, content string) error {
	channel := s.GetUserPreference(userID)
	switch channel {
	case models.ChannelEmail:
		email := s.GetUserEmail(userID)
		if email == "" || email == userID {
			log.Printf("[NOTICE] user %q has no email configured, falling back to in-app notification", userID)
			return s.sendInApp(userID, title, content)
		}
		if err := s.emailSender.Send(email, title, content); err != nil {
			log.Printf("[NOTICE] email send failed for %q: %v, falling back to in-app notification", userID, err)
			return s.sendInApp(userID, title, content)
		}
		s.sendInApp(userID, title, content)
		return nil
	case models.ChannelInApp:
		fallthrough
	default:
		return s.sendInApp(userID, title, content)
	}
}

func (s *NotificationService) sendInApp(userID, title, content string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	msg := &Message{
		ID:        fmt.Sprintf("msg_%d", len(s.inAppMessages[userID])+1),
		UserID:    userID,
		Title:     title,
		Content:   content,
		Channel:   models.ChannelInApp,
		Read:      false,
		CreatedAt: int64(len(s.inAppMessages[userID]) + 1),
	}
	s.inAppMessages[userID] = append(s.inAppMessages[userID], msg)
	log.Printf("[IN-APP] User: %s, Title: %s", userID, title)
	return nil
}

func (s *NotificationService) GetUnreadMessages(userID string) []*Message {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var unread []*Message
	for _, msg := range s.inAppMessages[userID] {
		if !msg.Read {
			unread = append(unread, msg)
		}
	}
	return unread
}

func (s *NotificationService) MarkAsRead(userID, messageID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, msg := range s.inAppMessages[userID] {
		if msg.ID == messageID {
			msg.Read = true
			break
		}
	}
}

func (s *NotificationService) NotifyApprovalPending(ctx context.Context, approver, instanceID, title, initiator string) error {
	return s.Send(ctx, approver,
		fmt.Sprintf("待审批：%s", title),
		fmt.Sprintf("您有一个待审批的申请。发起人：%s，申请标题：%s，流程实例ID：%s", initiator, title, instanceID))
}

func (s *NotificationService) NotifyTimeoutReminder(ctx context.Context, approver, instanceID, title string) error {
	return s.Send(ctx, approver,
		fmt.Sprintf("审批超时提醒：%s", title),
		fmt.Sprintf("您有一个审批申请即将超时，请尽快处理。流程实例ID：%s", instanceID))
}

func (s *NotificationService) NotifyApproved(ctx context.Context, initiator, instanceID, title, approver string) error {
	return s.Send(ctx, initiator,
		fmt.Sprintf("审批通过：%s", title),
		fmt.Sprintf("您的申请已通过审批。审批人：%s，流程实例ID：%s", approver, instanceID))
}

func (s *NotificationService) NotifyRejected(ctx context.Context, initiator, instanceID, title, approver, reason string) error {
	return s.Send(ctx, initiator,
		fmt.Sprintf("审批驳回：%s", title),
		fmt.Sprintf("您的申请已被驳回。审批人：%s，驳回原因：%s，流程实例ID：%s", approver, reason, instanceID))
}

func (s *NotificationService) NotifyTransferred(ctx context.Context, newApprover, instanceID, title, fromApprover string) error {
	return s.Send(ctx, newApprover,
		fmt.Sprintf("审批转交：%s", title),
		fmt.Sprintf("您收到一个转交的审批申请。转交人：%s，流程实例ID：%s", fromApprover, instanceID))
}
