package main

import (
	"log"

	"github.com/d4sw4r/blokhouse/api/v1"
	"github.com/d4sw4r/blokhouse/internal/service"
	"github.com/d4sw4r/blokhouse/internal/storage"
)

func main() {
	db := storage.NewMemoryStorage()
	svc := service.NewAssetSvc(db)
	s := api.NewApiServer(":9000", svc)
	log.Fatal(s.Start())
}
