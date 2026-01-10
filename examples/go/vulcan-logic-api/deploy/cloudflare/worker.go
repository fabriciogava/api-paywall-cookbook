package main

import (
	"os"

	"github.com/kobaru/api-paywall-cookbook/examples/go/vulcan-logic-api/src"
	"github.com/syumai/workers"
)

func main() {
	// Cloudflare Workers environment variables are accessed via os.Getenv
	config := src.AppConfig{
		BaseWalletAddress: os.Getenv("BASE_WALLET_ADDRESS"),
		FacilitatorURL:    os.Getenv("FACILITATOR_URL"),
		GeminiAPIKey:      os.Getenv("GEMINI_API_KEY"),
	}

	app := src.CreateApp(config)
	workers.Serve(app)
}
