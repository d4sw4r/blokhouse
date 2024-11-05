package main

import (
	"log"
	"log/slog"
	"os"

	"github.com/d4sw4r/blokhouse/internal/service"
	"github.com/d4sw4r/blokhouse/internal/storage"
	"github.com/d4sw4r/blokhouse/web"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	db := storage.NewMemoryStorage()
	svc := service.NewAssetSvc(db)
	// discoverysvc := service.NewDiscoverySvc(db)
	// go discoverysvc.Discover()
	s := web.NewServer(":8080", svc)
	log.Fatal(s.Start())
}
