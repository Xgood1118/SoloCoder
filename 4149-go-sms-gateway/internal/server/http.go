package server

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/sms-gateway/internal/channel"
	"github.com/sms-gateway/internal/core"
	"github.com/sms-gateway/internal/limiter"
	"github.com/sms-gateway/internal/logger"
	"github.com/sms-gateway/internal/risk"
	"github.com/sms-gateway/internal/service"
	"github.com/sms-gateway/pkg/utils"
)

type Server struct {
	port            int
	httpServer      *http.Server
	smsService      *service.SMSService
	callbackService *service.CallbackService
	channelManager  *channel.Manager
	logger          *logger.AsyncLogger
	metrics         *logger.Metrics
	riskControl     *risk.RiskControl
	taskQueue       *limiter.TaskQueue
}

func NewServer(port int, smsService *service.SMSService, callbackService *service.CallbackService,
	channelManager *channel.Manager, logger *logger.AsyncLogger, metrics *logger.Metrics,
	riskControl *risk.RiskControl, taskQueue *limiter.TaskQueue) *Server {
	return &Server{
		port:            port,
		smsService:      smsService,
		callbackService: callbackService,
		channelManager:  channelManager,
		logger:          logger,
		metrics:         metrics,
		riskControl:     riskControl,
		taskQueue:       taskQueue,
	}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/sms/send", s.handleSendSMS)
	mux.HandleFunc("/api/v1/sms/send_async", s.handleSendSMSAsync)
	mux.HandleFunc("/api/v1/sms/batch_send", s.handleBatchSendSMS)
	mux.HandleFunc("/api/v1/sms/batch_send_async", s.handleBatchSendSMSAsync)
	mux.HandleFunc("/api/v1/callback/report", s.handleDeliveryReport)
	mux.HandleFunc("/api/v1/callback/mo", s.handleMoMessage)
	mux.HandleFunc("/api/v1/channels", s.handleListChannels)
	mux.HandleFunc("/api/v1/metrics", s.handleMetrics)
	mux.HandleFunc("/api/v1/health", s.handleHealth)

	s.httpServer = &http.Server{
		Addr:         ":" + strconv.Itoa(s.port),
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	s.logger.Info("http server starting", "port", s.port)
	return s.httpServer.ListenAndServe()
}

func (s *Server) Stop() error {
	if s.httpServer != nil {
		return s.httpServer.Close()
	}
	return nil
}

func (s *Server) handleSendSMS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req core.SMSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Phone == "" {
		s.writeError(w, http.StatusBadRequest, "phone is required")
		return
	}

	if req.TemplateID == "" {
		s.writeError(w, http.StatusBadRequest, "template_id is required")
		return
	}

	resp, err := s.smsService.Send(r.Context(), &req)
	if err != nil {
		s.logger.Error("send sms failed", "error", err, "phone", utils.MaskPhone(req.Phone))
		s.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.writeSuccess(w, resp)
}

func (s *Server) handleSendSMSAsync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req core.SMSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Phone == "" {
		s.writeError(w, http.StatusBadRequest, "phone is required")
		return
	}

	if req.TemplateID == "" {
		s.writeError(w, http.StatusBadRequest, "template_id is required")
		return
	}

	messageID, err := s.smsService.SendAsync(r.Context(), &req)
	if err != nil {
		s.logger.Error("send sms async failed", "error", err, "phone", utils.MaskPhone(req.Phone))
		s.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.writeSuccess(w, map[string]interface{}{
		"message_id": messageID,
		"status":     "queued",
	})
}

func (s *Server) handleBatchSendSMS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req core.BatchSMSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.Phones) == 0 {
		s.writeError(w, http.StatusBadRequest, "phones is required")
		return
	}

	if req.TemplateID == "" {
		s.writeError(w, http.StatusBadRequest, "template_id is required")
		return
	}

	if len(req.TemplateVars) > 0 && len(req.TemplateVars) != len(req.Phones) {
		s.writeError(w, http.StatusBadRequest, "template_vars count mismatch")
		return
	}

	resp, err := s.smsService.BatchSend(r.Context(), &req)
	if err != nil {
		s.logger.Error("batch send sms failed", "error", err, "count", len(req.Phones))
		s.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.writeSuccess(w, resp)
}

func (s *Server) handleBatchSendSMSAsync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req core.BatchSMSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.Phones) == 0 {
		s.writeError(w, http.StatusBadRequest, "phones is required")
		return
	}

	if req.TemplateID == "" {
		s.writeError(w, http.StatusBadRequest, "template_id is required")
		return
	}

	if len(req.TemplateVars) > 0 && len(req.TemplateVars) != len(req.Phones) {
		s.writeError(w, http.StatusBadRequest, "template_vars count mismatch")
		return
	}

	messageIDs, err := s.smsService.BatchSendAsync(r.Context(), &req)
	if err != nil {
		s.logger.Error("batch send sms async failed", "error", err, "count", len(req.Phones))
		s.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.writeSuccess(w, map[string]interface{}{
		"message_ids": messageIDs,
		"status":      "queued",
		"count":       len(messageIDs),
	})
}

func (s *Server) handleDeliveryReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	channelName := r.URL.Query().Get("channel")
	if channelName == "" {
		s.writeError(w, http.StatusBadRequest, "channel is required")
		return
	}

	body := make([]byte, r.ContentLength)
	r.Body.Read(body)

	if err := s.callbackService.HandleDeliveryReport(channelName, body); err != nil {
		s.logger.Error("handle delivery report failed", "error", err, "channel", channelName)
		s.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.writeSuccess(w, map[string]string{"status": "ok"})
}

func (s *Server) handleMoMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	channelName := r.URL.Query().Get("channel")
	if channelName == "" {
		s.writeError(w, http.StatusBadRequest, "channel is required")
		return
	}

	body := make([]byte, r.ContentLength)
	r.Body.Read(body)

	if err := s.callbackService.HandleMoMessage(channelName, body); err != nil {
		s.logger.Error("handle mo message failed", "error", err, "channel", channelName)
		s.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.writeSuccess(w, map[string]string{"status": "ok"})
}

type ChannelWithStats interface {
	GetStats() (total int64, failed int64, rate float64)
}

func (s *Server) handleListChannels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	channels := s.channelManager.List()
	result := make([]map[string]interface{}, 0, len(channels))

	for _, ch := range channels {
		chConfig := ch.GetConfig()
		if statsCh, ok := ch.(ChannelWithStats); ok {
			total, failed, rate := statsCh.GetStats()
			chConfig["total_requests"] = total
			chConfig["failed_requests"] = failed
			chConfig["success_rate"] = rate
		}
		result = append(result, chConfig)
	}

	s.writeSuccess(w, result)
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	metrics := s.metrics.GetMetrics()
	metrics["queue_size"] = s.taskQueue.Len()

	s.writeSuccess(w, metrics)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	channels := s.channelManager.List()
	healthyCount := 0
	for _, ch := range channels {
		if ch.IsHealthy() {
			healthyCount++
		}
	}

	s.writeSuccess(w, map[string]interface{}{
		"status":          "ok",
		"total_channels":  len(channels),
		"healthy_channels": healthyCount,
		"queue_size":      s.taskQueue.Len(),
		"timestamp":       time.Now().Unix(),
	})
}

func (s *Server) writeSuccess(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"code":    0,
		"message": "success",
		"data":    data,
	})
}

func (s *Server) writeError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"code":    code,
		"message": message,
		"data":    nil,
	})
}
