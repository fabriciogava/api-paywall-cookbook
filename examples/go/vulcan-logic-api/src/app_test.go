package src

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// mockFacilitator returns a test server that provides /supported response
func mockFacilitator() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/supported" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"kinds": []map[string]interface{}{
					{
						"x402Version": 2,
						"scheme":      "exact",
						"network":     BaseNetworkID,
						"extra": map[string]interface{}{
							"asset":    BaseAssetAddress,
							"name":     "USDC",
							"version":  "2",
							"decimals": 6,
						},
					},
				},
				"signers": map[string][]string{
					BaseNetworkID: {"0x67a3176Acd5Db920747eef65b813B028Ad143CdB"},
				},
			})
			return
		}
		// Other endpoints (verify, settle) return empty success
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
}

// Helper to create a test app with mock facilitator
func createTestApp() http.Handler {
	server := mockFacilitator()
	// Note: server.Close() should be called after tests, but for simplicity we skip it

	config := AppConfig{
		BaseWalletAddress: "0xTestWallet",
		FacilitatorURL:    server.URL,
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
