package algorithm

import (
	"time"
)

func NewAlgorithm(cfg AlgorithmConfig) (Algorithm, error) {
	if err := ValidateConfig(cfg); err != nil {
		return nil, err
	}

	switch cfg.Type {
	case TokenBucketType:
		return NewTokenBucket(cfg.Rate, cfg.Burst, cfg.Window)
	case SlidingWindowType:
		bucketSize := cfg.BucketSize
		if bucketSize <= 0 || bucketSize >= cfg.Window {
			bucketSize = cfg.Window / 10
			if bucketSize == 0 {
				bucketSize = time.Millisecond
			}
		}
		return NewSlidingWindow(cfg.Rate, cfg.Burst, cfg.Window, bucketSize)
	default:
		return nil, ErrInvalidAlgorithmType
	}

}
