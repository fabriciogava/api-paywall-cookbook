package src

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// Helper to create a test app with dummy config
func createTestApp() http.Handler {
	config := AppConfig{
		BaseWalletAddress: "0xTestWallet",
		FacilitatorURL:    "https://test.kobaru.io",
		GeminiAPIKey:      "dummy-key",
	}
	return CreateApp(config)
}

func TestHealthEndpoint(t *testing.T) {
	router := createTestApp()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "functional", response["status"])
}

func TestRootEndpoint(t *testing.T) {
	router := createTestApp()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Vulcan Logic API")
}

func TestAdviceEndpoint_PaymentRequired(t *testing.T) {
	router := createTestApp()

	// Request without payment headers
	body := strings.NewReader(`{"question": "Logic?"}`)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/advice", body)
	req.Header.Set("Content-Type", "application/json")

	router.ServeHTTP(w, req)

	// x402 middleware should intercept and return 402
	assert.Equal(t, http.StatusPaymentRequired, w.Code)

	// Verify x402 headers are present (checking v2 header)
	assert.NotEmpty(t, w.Header().Get("PAYMENT-REQUIRED") != "" || w.Header().Get("WWW-AUTHENTICATE") != "")
}
