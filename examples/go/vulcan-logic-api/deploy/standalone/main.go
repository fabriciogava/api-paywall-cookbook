package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/kobaru/api-paywall-cookbook/examples/go/vulcan-logic-api/src"
)

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	baseWallet := os.Getenv("BASE_WALLET_ADDRESS")
	geminiKey := os.Getenv("GEMINI_API_KEY")

	if baseWallet == "" || geminiKey == "" {
		log.Fatal("❌ Missing required environment variables: BASE_WALLET_ADDRESS, GEMINI_API_KEY")
	}

	config := src.AppConfig{
		BaseWalletAddress: baseWallet,
		FacilitatorURL:    os.Getenv("FACILITATOR_URL"),
		GeminiAPIKey:      geminiKey,
	}

	// Create App
	app := src.CreateApp(config)

	// Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("🖖 Vulcan Logic API running on port %s", port)
	log.Printf("💰 Price: %s (USDC on Base Sepolia)", src.AdvicePrice)
	log.Printf("📝 Wallet: %s", baseWallet)

	// Create HTTP server with timeouts
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      app,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second, // Longer for AI responses
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server gracefully...")

	// Give ongoing requests 30 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped")
}
