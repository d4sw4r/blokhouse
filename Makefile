test: 
	go test -v ./...
	go vet ./...

build: test
	@go build -o blokhouse cmd/blokhouse/main.go
run: 
	go run cmd/blokhouse/main.go
