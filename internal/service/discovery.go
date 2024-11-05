package service

import (
	"fmt"
	"os"

	"github.com/d4sw4r/blokhouse/internal/models"
	"github.com/google/uuid"
	"github.com/jpillora/icmpscan"
)

type DiscoverySvc struct {
	DB models.AssetDB
}

func NewDiscoverySvc(db models.AssetDB) DiscoverySvc {
	return DiscoverySvc{DB: db}
}

func (s DiscoverySvc) Discover() {
	hosts, err := icmpscan.Run(icmpscan.Spec{
		Hostnames: true,
		MACs:      true,
		Log:       false,
	})
	if err != nil {
		fmt.Print(err)
		os.Exit(1)
	}
	targets := []models.DiscoveryTarget{}
	for _, h := range hosts {
		targets = append(targets, models.DiscoveryTarget{Name: h.Hostname, IP: h.IP.String(), Mac: h.MAC})
		assettype := models.AssetType{Id: 6, Name: h.MAC}
		asset := models.Asset{
			Id:   uuid.New(),
			Name: h.Hostname,
			IP:   h.IP.String(),
			Type: assettype,
		}
		s.DB.Create(&asset)
	}

}
