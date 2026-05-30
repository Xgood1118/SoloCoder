package config

import "errors"

var (
	ErrInvalidConfig    = errors.New("invalid configuration")
	ErrInvalidRuleID    = errors.New("rule id must not be empty")
	ErrNoMatchers       = errors.New("rule must have at least one matcher")
	ErrNoDimensions     = errors.New("rule must have at least one dimension")
	ErrEmptyPattern     = errors.New("matcher pattern must not be empty")
	ErrRuleNotFound     = errors.New("rule not found")
	ErrHotReloadFailed  = errors.New("hot reload failed")
	ErrConfigNotLoaded  = errors.New("configuration not loaded")
	ErrInvalidMatcher   = errors.New("invalid matcher type")
	ErrInvalidDimension = errors.New("invalid dimension type")
)
