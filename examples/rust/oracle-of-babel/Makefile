.PHONY: all build run test clean docker

all: build

build:
	cargo build --release

run:
	cargo run --bin standalone

test:
	cargo test

clean:
	cargo clean

docker:
	cd deploy/docker && docker-compose up --build

docker-down:
	cd deploy/docker && docker-compose down
