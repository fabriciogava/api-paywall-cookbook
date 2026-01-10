.PHONY: build-wasm

build-wasm:
	mkdir -p build
	tinygo build -o build/worker.wasm -target wasm -no-debug ./deploy/cloudflare/worker.go
