# Blokhouse

This project aims to be a easy and simple to use CMDB, build with a automation first approach. The goal should be to have an easy to setup DB with all your assets, which then can be filled and read with automation tools like ansible, puppet, ect. and custom REST-API scripts, depending on your infrastructure.

# Usage
```
# Docker
docker pull ghcr.io/d4sw4r/blokhouse:latest
docker run -p 8080:8080 ghcr.io/d4sw4r/blokhouse:latest

# Binary
./blokhouse
```

# Build
```
# local installtion of templ is required
templ generate .
go build -o blokhouse cmd/blokhouse/main.go