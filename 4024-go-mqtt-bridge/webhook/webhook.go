package webhook

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"time"
)

type Sender struct {
	client         *http.Client
	url            string
	method         string
	headers        map[string]string
	maxRetries     int
	baseBackoff    time.Duration
	maxBackoff     time.Duration
	retryQueue     chan *retryJob
	stopCh         chan struct{}
	onSuccess      func(body []byte)
	onPermanentErr func(body []byte, err error)
}

type retryJob struct {
	body      []byte
	attempt   int
	nextRetry time.Time
}

func New(url, method string, headers map[string]string, timeout, maxRetries, baseBackoffSec, maxBackoffSec int) *Sender {
	if method == "" {
		method = http.MethodPost
	}
	s := &Sender{
		client: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
		},
		url:         url,
		method:      method,
		headers:     headers,
		maxRetries:  maxRetries,
		baseBackoff: time.Duration(baseBackoffSec) * time.Second,
		maxBackoff:  time.Duration(maxBackoffSec) * time.Second,
		retryQueue:  make(chan *retryJob, 1024),
		stopCh:      make(chan struct{}),
	}
	go s.retryLoop()
	return s
}

func (s *Sender) Stop() {
	close(s.stopCh)
}

func (s *Sender) SetSuccessHandler(fn func(body []byte))         { s.onSuccess = fn }
func (s *Sender) SetPermanentErrorHandler(fn func(body []byte, err error)) { s.onPermanentErr = fn }

func (s *Sender) Send(body []byte) error {
	if err := s.doRequest(body); err != nil {
		job := &retryJob{body: body, attempt: 1}
		job.nextRetry = time.Now().Add(s.backoff(0))
		select {
		case s.retryQueue <- job:
		default:
			log.Printf("[webhook] retry queue full, dropping message")
		}
		return err
	}
	if s.onSuccess != nil {
		s.onSuccess(body)
	}
	return nil
}

func (s *Sender) doRequest(body []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), s.client.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, s.method, s.url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range s.headers {
		req.Header.Set(k, v)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("http status %d", resp.StatusCode)
	}
	return nil
}

func (s *Sender) backoff(attempt int) time.Duration {
	mult := math.Pow(2, float64(attempt))
	d := time.Duration(float64(s.baseBackoff) * mult)
	if d > s.maxBackoff {
		d = s.maxBackoff
	}
	return d
}

func (s *Sender) retryLoop() {
	timer := time.NewTimer(0)
	defer timer.Stop()
	var pending []*retryJob

	for {
		var nextTick time.Duration = time.Second
		if len(pending) > 0 {
			nextTick = time.Until(pending[0].nextRetry)
			if nextTick < 0 {
				nextTick = 0
			}
		}
		timer.Reset(nextTick)

		select {
		case <-s.stopCh:
			return
		case job := <-s.retryQueue:
			pending = insertByTime(pending, job)
		case <-timer.C:
			if len(pending) == 0 {
				continue
			}
			job := pending[0]
			pending = pending[1:]
			if time.Now().Before(job.nextRetry) {
				pending = insertByTime(pending, job)
				continue
			}
			if err := s.doRequest(job.body); err != nil {
				log.Printf("[webhook] retry %d/%d failed: %v", job.attempt, s.maxRetries, err)
				if job.attempt >= s.maxRetries {
					log.Printf("[webhook] message permanently failed after %d retries", s.maxRetries)
					if s.onPermanentErr != nil {
						s.onPermanentErr(job.body, err)
					}
					continue
				}
				job.attempt++
				job.nextRetry = time.Now().Add(s.backoff(job.attempt - 1))
				pending = insertByTime(pending, job)
			} else {
				log.Printf("[webhook] message delivered on retry %d", job.attempt)
				if s.onSuccess != nil {
					s.onSuccess(job.body)
				}
			}
		}
	}
}

func insertByTime(jobs []*retryJob, job *retryJob) []*retryJob {
	idx := 0
	for i, j := range jobs {
		if job.nextRetry.Before(j.nextRetry) {
			idx = i
			return append(jobs[:idx], append([]*retryJob{job}, jobs[idx:]...)...)
		}
		idx = i + 1
	}
	return append(jobs, job)
}
