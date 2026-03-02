// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package retryutil

import (
	"context"
	"errors"
	"fmt"
	"net"
	"testing"
	"time"
)

func TestRetryWithBackoff_Success(t *testing.T) {
	attempts := 0
	fn := func() error {
		attempts++
		if attempts < 3 {
			return &RetryableError{Err: errors.New("temporary error")}
		}
		return nil
	}

	opts := DefaultRetryOptions()
	opts.InitialDelay = 10 * time.Millisecond
	err := RetryWithBackoff(context.Background(), fn, opts)

	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
}

func TestRetryWithBackoff_MaxRetries(t *testing.T) {
	attempts := 0
	fn := func() error {
		attempts++
		return &RetryableError{Err: errors.New("persistent error")}
	}

	opts := DefaultRetryOptions()
	opts.MaxRetries = 2
	opts.InitialDelay = 10 * time.Millisecond
	err := RetryWithBackoff(context.Background(), fn, opts)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if attempts != 3 { // Initial + 2 retries
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
}

func TestRetryWithBackoff_NonRetryable(t *testing.T) {
	attempts := 0
	fn := func() error {
		attempts++
		return &NonRetryableError{Err: errors.New("permanent error")}
	}

	opts := DefaultRetryOptions()
	opts.InitialDelay = 10 * time.Millisecond
	err := RetryWithBackoff(context.Background(), fn, opts)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if attempts != 1 {
		t.Fatalf("expected 1 attempt (no retry), got %d", attempts)
	}
}

func TestRetryWithBackoff_ContextCancellation(t *testing.T) {
	attempts := 0
	fn := func() error {
		attempts++
		return &RetryableError{Err: errors.New("temporary error")}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	opts := DefaultRetryOptions()
	opts.InitialDelay = 100 * time.Millisecond // Longer than context timeout
	err := RetryWithBackoff(ctx, fn, opts)

	if err != context.DeadlineExceeded {
		t.Fatalf("expected context deadline exceeded, got: %v", err)
	}
}

func TestRetryWithBackoff_ExponentialBackoff(t *testing.T) {
	var delays []time.Duration
	attempts := 0

	fn := func() error {
		attempts++
		if attempts < 4 {
			return &RetryableError{Err: errors.New("temporary")}
		}
		return nil
	}

	opts := DefaultRetryOptions()
	opts.MaxRetries = 3
	opts.InitialDelay = 100 * time.Millisecond
	opts.BackoffMultiplier = 2.0
	opts.OnRetry = func(attempt int, err error, delay time.Duration) {
		delays = append(delays, delay)
	}

	err := RetryWithBackoff(context.Background(), fn, opts)

	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if len(delays) != 3 {
		t.Fatalf("expected 3 delays, got %d", len(delays))
	}

	// Check exponential backoff: 100ms, 200ms, 400ms
	expectedDelays := []time.Duration{
		100 * time.Millisecond,
		200 * time.Millisecond,
		400 * time.Millisecond,
	}
	for i, expected := range expectedDelays {
		if delays[i] != expected {
			t.Errorf("delay[%d]: expected %v, got %v", i, expected, delays[i])
		}
	}
}

func TestRetryWithBackoff_MaxDelay(t *testing.T) {
	var delays []time.Duration

	fn := func() error {
		return &RetryableError{Err: errors.New("temporary")}
	}

	opts := DefaultRetryOptions()
	opts.MaxRetries = 3
	opts.InitialDelay = 1 * time.Second
	opts.MaxDelay = 2 * time.Second
	opts.BackoffMultiplier = 2.0
	opts.OnRetry = func(attempt int, err error, delay time.Duration) {
		delays = append(delays, delay)
	}

	_ = RetryWithBackoff(context.Background(), fn, opts)

	// Check that delay is capped at maxDelay
	// Expected: 1s, 2s (capped), 2s (capped)
	if delays[1] > opts.MaxDelay {
		t.Errorf("delay[1] exceeded maxDelay: %v > %v", delays[1], opts.MaxDelay)
	}
	if delays[2] > opts.MaxDelay {
		t.Errorf("delay[2] exceeded maxDelay: %v > %v", delays[2], opts.MaxDelay)
	}
}

func TestRetryWithBackoffValue_Success(t *testing.T) {
	attempts := 0
	fn := func() (string, error) {
		attempts++
		if attempts < 3 {
			return "", &RetryableError{Err: errors.New("temporary error")}
		}
		return "success", nil
	}

	opts := DefaultRetryOptions()
	opts.InitialDelay = 10 * time.Millisecond
	result, err := RetryWithBackoffValue(context.Background(), fn, opts)

	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if result != "success" {
		t.Fatalf("expected 'success', got '%s'", result)
	}
	if attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
}

func TestDefaultShouldRetry_NetworkErrors(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{"nil error", nil, false},
		{"context canceled", context.Canceled, false},
		{"context deadline exceeded", context.DeadlineExceeded, false},
		{"connection refused", fmt.Errorf("connection refused"), true},
		{"connection reset", fmt.Errorf("connection reset by peer"), true},
		{"timeout", fmt.Errorf("i/o timeout"), true},
		{"unauthorized", fmt.Errorf("unauthorized"), false},
		{"forbidden", fmt.Errorf("forbidden"), false},
		{"temporary net error", &net.DNSError{IsTemporary: true}, true},
		{"retryable error", &RetryableError{Err: errors.New("temp")}, true},
		{"non-retryable error", &NonRetryableError{Err: errors.New("perm")}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := DefaultShouldRetry(tt.err)
			if result != tt.expected {
				t.Errorf("DefaultShouldRetry(%v) = %v, want %v", tt.err, result, tt.expected)
			}
		})
	}
}

func TestIsRetryableHTTPStatus(t *testing.T) {
	tests := []struct {
		status   int
		expected bool
	}{
		{200, false},
		{201, false},
		{400, false},
		{401, false},
		{403, false},
		{404, false},
		{408, true}, // Request Timeout
		{429, true}, // Too Many Requests
		{500, true},
		{502, true},
		{503, true}, // Service Unavailable
		{504, true}, // Gateway Timeout
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("status_%d", tt.status), func(t *testing.T) {
			result := IsRetryableHTTPStatus(tt.status)
			if result != tt.expected {
				t.Errorf("IsRetryableHTTPStatus(%d) = %v, want %v", tt.status, result, tt.expected)
			}
		})
	}
}
