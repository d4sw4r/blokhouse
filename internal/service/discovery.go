package service

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/jpillora/icmpscan"
	"github.com/pocketbase/pocketbase"
	pb_models "github.com/pocketbase/pocketbase/models"
)

type DiscoverySvc struct {
	PB pocketbase.PocketBase
}

func NewDiscoverySvc(pb pocketbase.PocketBase) DiscoverySvc {
	return DiscoverySvc{PB: pb}
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

	for _, h := range hosts {
		collection, err := s.PB.Dao().FindCollectionByNameOrId("discover")
		if err != nil {
			fmt.Println(err)
		}

		result, err := s.PB.Dao().FindFirstRecordByData("discover", "mac", h.MAC)
		if err != nil {
			fmt.Println(err)
		}
		if result == nil {

			record := pb_models.NewRecord(collection)

			record.Set("name", h.Hostname)
			record.Set("ip", h.IP.String())
			record.Set("mac", h.MAC)

			if err := s.PB.Dao().SaveRecord(record); err != nil {
				slog.Warn("could not store in database")
			}
		}
	}

}
