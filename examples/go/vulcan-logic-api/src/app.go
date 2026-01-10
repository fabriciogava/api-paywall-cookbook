package src

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	x402 "github.com/coinbase/x402/go"
	x402http "github.com/coinbase/x402/go/http"
	x402gin "github.com/coinbase/x402/go/http/gin"
	x402evm "github.com/coinbase/x402/go/mechanisms/evm/exact/server"
	"github.com/gin-gonic/gin"
	"google.golang.org/genai"
)

// AppConfig holds the configuration for the application
type AppConfig struct {
	BaseWalletAddress string
	FacilitatorURL    string
	GeminiAPIKey      string
}

const (
	// Base Sepolia Network ID (CAIP-2)
	BaseNetworkID = "eip155:84532"
	// USDC on Base Sepolia
	BaseAssetAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
	// Price per request
	AdvicePrice = "$0.001"
)

// AdviceRequest represents the user's question
type AdviceRequest struct {
	Question string `json:"question" binding:"required"`
}

// AdviceResponse represents Spock's answer
type AdviceResponse struct {
	Advice string `json:"advice"`
}

// CreateApp creates and configures the Gin engine
func CreateApp(config AppConfig) *gin.Engine {
	// Set Gin mode based on environment
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// Add basic CORS support for browser clients
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Payment-Required, WWW-Authenticate")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// Initialize Gemini Client
	ctx := context.Background()
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey: config.GeminiAPIKey,
	})
	if err != nil {
		log.Printf("Failed to create Gemini client: %v", err)
		// Return a minimal app that will fail requests gracefully
		r.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "degraded", "error": "AI service unavailable"})
		})
		return r
	}

	// Define x402 Routes Configuration
	routesConfig := x402http.RoutesConfig{
		"POST /advice": {
			Accepts: []x402http.PaymentOption{{
				Scheme:  "exact",
				Network: x402.Network(BaseNetworkID),
				PayTo:   config.BaseWalletAddress,
				Price:   AdvicePrice,
				Extra: map[string]interface{}{
					"asset": BaseAssetAddress,
				},
			}},
			Description: "Logical advice from Mr. Spock",
			Resource:    "vulcan-logic-advice",
		},
	}

	// Create x402 Middleware
	// We use PaymentMiddlewareFromConfig which internally creates the resource server
	// and handles the x402 protocol flow (402 Payment Required, Verification, etc.)
	facilitatorURL := config.FacilitatorURL
	if facilitatorURL == "" {
		facilitatorURL = "https://gateway.kobaru.io"
	}

	// Facilitator client
	facilitatorClient := x402http.NewHTTPFacilitatorClient(&x402http.FacilitatorConfig{
		URL: facilitatorURL,
	})

	// Create x402 Middleware with graceful error handling
	// We disable SyncFacilitatorOnStart to prevent crashing if the facilitator returns malformed data
	paymentMiddleware := x402gin.X402Payment(x402gin.Config{
		Routes:      routesConfig,
		Facilitator: facilitatorClient,
		Schemes: []x402gin.SchemeConfig{
			{
				Network: x402.Network(BaseNetworkID),
				Server:  x402evm.NewExactEvmScheme(),
			},
		},
		SyncFacilitatorOnStart: false, // Prevent crash on broken facilitator response
	})

	// Apply Middleware
	r.Use(paymentMiddleware)

	// Routes
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":        "Vulcan Logic API",
			"description": "Fascinating. Deep Thought was... inefficient. I provide logic immediately.",
			"endpoints": map[string]string{
				"/":       "Introduction",
				"/advice": "Ask for advice (Payment Required: " + AdvicePrice + ")",
				"/health": "Health check",
			},
		})
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "functional", "logic_levels": "optimal"})
	})

	r.POST("/advice", func(c *gin.Context) {
		var req AdviceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format. Illogical."})
			return
		}

		// Generate Wisdom from Gemini (Spock Persona)
		advice, err := generateSpockAdvice(c.Request.Context(), client, req.Question)
		if err != nil {
			log.Printf("Gemini error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal processing error. Emotionally compromising."})
			return
		}

		c.JSON(http.StatusOK, AdviceResponse{Advice: advice})
	})

	return r
}

func generateSpockAdvice(ctx context.Context, client *genai.Client, question string) (string, error) {
	// Add timeout for external API call to prevent hanging
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	prompt := fmt.Sprintf(SpockSystemPrompt, question)

	resp, err := client.Models.GenerateContent(ctx, "gemini-2.5-flash", genai.Text(prompt), nil)
	if err != nil {
		return "", err
	}

	if resp == nil || len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "No logical response could be formulated.", nil
	}

	// Extract text from the first part
	// Note: genai SDK structure might vary, adjusting for common structure
	part := resp.Candidates[0].Content.Parts[0]
	if part.Text != "" {
		return part.Text, nil
	}

	return "Response format illogical.", nil
}
