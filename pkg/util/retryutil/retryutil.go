// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package retryutil

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net"
	"net/http"
	"strings"
	"time"
)

// RetryableError wraps an error that should be retried
type RetryableError struct {
	Err error
}

func (e *RetryableError) Error() string {
	return fmt.Sprintf("retryable error: %v", e.Err)
}

func (e *RetryableError) Unwrap() error {
	return e.Err
}

// NonRetryableError wraps an error that should not be retried
type NonRetryableError struct {
	Err error
}

func (e *NonRetryableError) Error() string {
	return fmt.Sprintf("non-retryable error: %v", e.Err)
}

func (e *NonRetryableError) Unwrap() error {
	return e.Err
}

// RetryOptions configures retry behavior
type RetryOptions struct {
	MaxRetries         int
	InitialDelay       time.Duration
	MaxDelay           time.Duration
	BackoffMultiplier  float64
	ShouldRetry        func(error) bool
	OnRetry            func(attempt int, err error, delay time.Duration)
}

// DefaultRetryOptions returns sensible defaults
func DefaultRetryOptions() RetryOptions {
	return RetryOptions{
		MaxRetries:        3,
		InitialDelay:      1 * time.Second,
		MaxDelay:          16 * time.Second,
		BackoffMultiplier: 2.0,
		ShouldRetry:       DefaultShouldRetry,
		OnRetry:           nil,
	}
}

// DefaultShouldRetry determines if an error should be retried
func DefaultShouldRetry(err error) bool {
	if err == nil {
		return false
	}

	// Check for explicit retry markers
	var nonRetryable *NonRetryableError
	if errors.As(err, &nonRetryable) {
		return false
	}

	var retryable *RetryableError
	if errors.As(err, &retryable) {
		return true
	}

	// Check for context cancellation (don't retry)
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}

	// Check for network errors (retry)
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}

	// Check error message for common network issues
	errMsg := strings.ToLower(err.Error())
	networkKeywords := []string{
		"connection refused",
		"connection reset",
		"broken pipe",
		"no route to host",
		"network is unreachable",
		"i/o timeout",
		"temporary failure",
		"timeout",
		"eof",
	}
	for _, keyword := range networkKeywords {
		if strings.Contains(errMsg, keyword) {
			return true
		}
	}

	// Don't retry authentication errors
	authKeywords := []string{
		"unauthorized",
		"forbidden",
		"authentication failed",
		"permission denied",
		"access denied",
	}
	for _, keyword := range authKeywords {
		if strings.Contains(errMsg, keyword) {
			return false
		}
	}

	// Default to not retrying unknown errors (conservative)
	return false
}

// IsRetryableHTTPStatus checks if an HTTP status code should be retried
func IsRetryableHTTPStatus(statusCode int) bool {
	switch statusCode {
	case http.StatusTooManyRequests,      // 429
		http.StatusServiceUnavailable,    // 503
		http.StatusGatewayTimeout,        // 504
		http.StatusRequestTimeout:        // 408
		return true
	}
	// Retry on 5xx errors
	return statusCode >= 500
}

// RetryWithBackoff retries a function with exponential backoff
func RetryWithBackoff(ctx context.Context, fn func() error, opts RetryOptions) error {
	var lastErr error

	for attempt := 0; attempt <= opts.MaxRetries; attempt++ {
		// Try the operation
		err := fn()
		if err == nil {
			return nil
		}

		lastErr = err

		// Check if we should retry
		shouldRetry := opts.ShouldRetry
		if shouldRetry == nil {
			shouldRetry = DefaultShouldRetry
		}

		if attempt >= opts.MaxRetries || !shouldRetry(err) {
			return err
		}

		// Calculate delay with exponential backoff
		delay := time.Duration(float64(opts.InitialDelay) * math.Pow(opts.BackoffMultiplier, float64(attempt)))
		if delay > opts.MaxDelay {
			delay = opts.MaxDelay
		}

		// Notify about retry
		if opts.OnRetry != nil {
			opts.OnRetry(attempt+1, err, delay)
		}

		// Wait before retrying, respecting context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
			// Continue to next attempt
		}
	}

	return lastErr
}

// RetryWithBackoffValue is like RetryWithBackoff but for functions that return a value
func RetryWithBackoffValue[T any](ctx context.Context, fn func() (T, error), opts RetryOptions) (T, error) {
	var lastErr error
	var result T

	for attempt := 0; attempt <= opts.MaxRetries; attempt++ {
		// Try the operation
		var err error
		result, err = fn()
		if err == nil {
			return result, nil
		}

		lastErr = err

		// Check if we should retry
		shouldRetry := opts.ShouldRetry
		if shouldRetry == nil {
			shouldRetry = DefaultShouldRetry
		}

		if attempt >= opts.MaxRetries || !shouldRetry(err) {
			return result, err
		}

		// Calculate delay with exponential backoff
		delay := time.Duration(float64(opts.InitialDelay) * math.Pow(opts.BackoffMultiplier, float64(attempt)))
		if delay > opts.MaxDelay {
			delay = opts.MaxDelay
		}

		// Notify about retry
		if opts.OnRetry != nil {
			opts.OnRetry(attempt+1, err, delay)
		}

		// Wait before retrying, respecting context cancellation
		select {
		case <-ctx.Done():
			return result, ctx.Err()
		case <-time.After(delay):
			// Continue to next attempt
		}
	}

	return result, lastErr
}

// CreateHTTPShouldRetry creates a retry predicate for HTTP errors
func CreateHTTPShouldRetry(additionalRetryable func(error) bool) func(error) bool {
	return func(err error) bool {
		if err == nil {
			return false
		}

		// Check explicit markers
		var nonRetryable *NonRetryableError
		if errors.As(err, &nonRetryable) {
			return false
		}

		var retryable *RetryableError
		if errors.As(err, &retryable) {
			return true
		}

		// Check additional custom logic
		if additionalRetryable != nil && additionalRetryable(err) {
			return true
		}

		// Use default logic
		return DefaultShouldRetry(err)
	}
}
