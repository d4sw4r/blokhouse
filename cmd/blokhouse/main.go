package main

import (
	"log"
	"log/slog"
	"os"

	"github.com/d4sw4r/blokhouse/api/v1"
	"github.com/d4sw4r/blokhouse/internal/service"
	"github.com/d4sw4r/blokhouse/internal/storage"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	db := storage.NewMemoryStorage()
	svc := service.NewAssetSvc(db)
	s := api.NewServer(":9000", svc)
	log.Fatal(s.Start())
}
