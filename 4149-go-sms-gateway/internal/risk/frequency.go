package risk

import (
	"sync"
	"time"
)

type FrequencyLimiter struct {
	phoneDailyLimit  int
	phoneHourlyLimit int
	ipDailyLimit     int

	phoneCount  map[string]*PhoneCounter
	ipCount     map[string]*IPCounter
	mu          sync.RWMutex
}

type PhoneCounter struct {
	DailyCount  int
	HourlyCount int
	LastDaily   time.Time
	LastHourly  time.Time
	mu          sync.Mutex
}

type IPCounter struct {
	DailyCount int
	LastDaily  time.Time
	mu         sync.Mutex
}

func NewFrequencyLimiter(phoneDailyLimit, phoneHourlyLimit, ipDailyLimit int) *FrequencyLimiter {
	fl := &FrequencyLimiter{
		phoneDailyLimit:  phoneDailyLimit,
		phoneHourlyLimit: phoneHourlyLimit,
		ipDailyLimit:     ipDailyLimit,
		phoneCount:       make(map[string]*PhoneCounter),
		ipCount:          make(map[string]*IPCounter),
	}

	go fl.cleanupExpired()
	return fl
}

func (fl *FrequencyLimiter) CheckPhone(phone string) bool {
	fl.mu.RLock()
	counter, exists := fl.phoneCount[phone]
	fl.mu.RUnlock()

	if !exists {
		fl.mu.Lock()
		counter = &PhoneCounter{
			LastDaily:  time.Now(),
			LastHourly: time.Now(),
		}
		fl.phoneCount[phone] = counter
		fl.mu.Unlock()
	}

	counter.mu.Lock()
	defer counter.mu.Unlock()

	now := time.Now()
	if now.Day() != counter.LastDaily.Day() || now.Month() != counter.LastDaily.Month() || now.Year() != counter.LastDaily.Year() {
		counter.DailyCount = 0
		counter.LastDaily = now
	}

	if now.Hour() != counter.LastHourly.Hour() || now.Day() != counter.LastHourly.Day() {
		counter.HourlyCount = 0
		counter.LastHourly = now
	}

	if counter.DailyCount >= fl.phoneDailyLimit || counter.HourlyCount >= fl.phoneHourlyLimit {
		return false
	}

	counter.DailyCount++
	counter.HourlyCount++
	return true
}

func (fl *FrequencyLimiter) CheckIP(ip string) bool {
	fl.mu.RLock()
	counter, exists := fl.ipCount[ip]
	fl.mu.RUnlock()

	if !exists {
		fl.mu.Lock()
		counter = &IPCounter{
			LastDaily: time.Now(),
		}
		fl.ipCount[ip] = counter
		fl.mu.Unlock()
	}

	counter.mu.Lock()
	defer counter.mu.Unlock()

	now := time.Now()
	if now.Day() != counter.LastDaily.Day() || now.Month() != counter.LastDaily.Month() || now.Year() != counter.LastDaily.Year() {
		counter.DailyCount = 0
		counter.LastDaily = now
	}

	if counter.DailyCount >= fl.ipDailyLimit {
		return false
	}

	counter.DailyCount++
	return true
}

func (fl *FrequencyLimiter) Check(phone, ip string) bool {
	if phone != "" && !fl.CheckPhone(phone) {
		return false
	}

	if ip != "" && !fl.CheckIP(ip) {
		return false
	}

	return true
}

func (fl *FrequencyLimiter) cleanupExpired() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		fl.mu.Lock()
		now := time.Now()

		for phone, counter := range fl.phoneCount {
			counter.mu.Lock()
			if now.Sub(counter.LastDaily) > 48*time.Hour {
				delete(fl.phoneCount, phone)
			}
			counter.mu.Unlock()
		}

		for ip, counter := range fl.ipCount {
			counter.mu.Lock()
			if now.Sub(counter.LastDaily) > 48*time.Hour {
				delete(fl.ipCount, ip)
			}
			counter.mu.Unlock()
		}

		fl.mu.Unlock()
	}
}

func (fl *FrequencyLimiter) GetPhoneCount(phone string) (daily, hourly int) {
	fl.mu.RLock()
	counter, exists := fl.phoneCount[phone]
	fl.mu.RUnlock()

	if !exists {
		return 0, 0
	}

	counter.mu.Lock()
	defer counter.mu.Unlock()

	now := time.Now()
	if now.Day() != counter.LastDaily.Day() || now.Month() != counter.LastDaily.Month() || now.Year() != counter.LastDaily.Year() {
		counter.DailyCount = 0
		counter.LastDaily = now
	}

	if now.Hour() != counter.LastHourly.Hour() || now.Day() != counter.LastHourly.Day() {
		counter.HourlyCount = 0
		counter.LastHourly = now
	}

	return counter.DailyCount, counter.HourlyCount
}

func (fl *FrequencyLimiter) ResetPhone(phone string) {
	fl.mu.Lock()
	delete(fl.phoneCount, phone)
	fl.mu.Unlock()
}

func (fl *FrequencyLimiter) ResetIP(ip string) {
	fl.mu.Lock()
	delete(fl.ipCount, ip)
	fl.mu.Unlock()
}

type RiskControl struct {
	sensitiveFilter *MultiLayerFilter
	frequencyLimiter *FrequencyLimiter
}

func NewRiskControl(sensitiveWords []string, phoneDailyLimit, phoneHourlyLimit, ipDailyLimit int) *RiskControl {
	multiFilter := NewMultiLayerFilter()
	if len(sensitiveWords) > 0 {
		defaultFilter := NewSensitiveWordFilter(sensitiveWords)
		multiFilter.AddFilter(defaultFilter)
	}

	return &RiskControl{
		sensitiveFilter:  multiFilter,
		frequencyLimiter: NewFrequencyLimiter(phoneDailyLimit, phoneHourlyLimit, ipDailyLimit),
	}
}

func (rc *RiskControl) CheckSensitiveWords(content string) (bool, []string) {
	return rc.sensitiveFilter.Check(content)
}

func (rc *RiskControl) CheckFrequency(phone string, ip string) bool {
	return rc.frequencyLimiter.Check(phone, ip)
}

func (rc *RiskControl) CheckTemplate(templateID string) bool {
	return true
}

func (rc *RiskControl) AddSensitiveWords(words []string) {
	filter := NewSensitiveWordFilter(words)
	rc.sensitiveFilter.AddFilter(filter)
}

func (rc *RiskControl) FilterSensitiveWords(content string) string {
	return rc.sensitiveFilter.Filter(content, '*')
}
