package main

import (
	"fmt"
	"log"
	"log/slog"
	"os"

	"github.com/d4sw4r/blokhouse/internal/service"
	"github.com/d4sw4r/blokhouse/web/ui"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	pb := pocketbase.New()

	pb.OnAfterBootstrap().Add(func(e *core.BootstrapEvent) error {
		settings, err := e.App.Dao().FindSettings()
		if err != nil {
			e.App.Logger().Error("settings not found", err.Error())
		}
		settings.Meta.AppName = "blokkhouse"
		//settings.Meta.AppUrl = "app url?"
		settings.Meta.HideControls = true
		settings.Meta.SenderName = "admin"
		settings.Meta.SenderAddress = "admin@blokkhouse.org"

		err = e.App.Dao().SaveSettings(settings)
		if err != nil {
			e.App.Logger().Error("settings sould not be saved", err.Error())
		}
		return nil
	})

	// pb.RefreshSettings()
	// config := pocketbase.Config{
	// 	DefaultDataDir:  "./database",
	// 	HideStartBanner: true,
	// }
	// pb := pocketbase.NewWithConfig(config)

	a := service.NewAnsibleService(*pb)
	fmt.Println(a)

	err := ui.RegisterHandler(*pb)
	if err != nil {
		pb.Logger().Info("error resgister Handler")
	}

	// discoverysvc := service.NewDiscoverySvc(*pb)
	// go discoverysvc.Discover()
	pb.Logger().Info("starting...")
	if err := pb.Start(); err != nil {
		log.Fatal(err)
	}
}
