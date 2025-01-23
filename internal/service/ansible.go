package service

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/models"
)

type AnsibleService struct {
	PB pocketbase.PocketBase
}

func NewAnsibleService(pb pocketbase.PocketBase) AnsibleService {
	srv := AnsibleService{PB: pb}
	srv.registerHandler()
	return srv
}

func (a AnsibleService) registerHandler() error {
	a.PB.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		e.Router.GET("/ansible", a.HandleAnsible)
		return nil
	})
	return nil
}

func (a AnsibleService) HandleAnsible(c echo.Context) error {
	query := a.PB.Dao().RecordQuery("asset")

	records := []*models.Record{}
	if err := query.All(&records); err != nil {
		fmt.Println(err)
	}
	rsp := []byte{}
	for _, v := range records {
		//fmt.Println(v.GetString("name"))
		fmt.Println(v.PublicExport())
		jsonString, err := json.Marshal(v.PublicExport())
		rsp = append(rsp, jsonString...)
		if err != nil {
			fmt.Println(err)
		}
		//fmt.Println(string(jsonString))
	}

	return c.JSON(http.StatusOK, string(rsp))

}
