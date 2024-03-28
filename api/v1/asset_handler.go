package api

import (
	"net/http"

	"github.com/d4sw4r/blokhouse/internal/models"
	"github.com/d4sw4r/blokhouse/internal/service"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

func createAsset(c echo.Context) error {
	// lock.Lock()
	// defer lock.Unlock()
	s := c.Get("svc").(service.AssetSvc)
	as := models.Asset{Id: uuid.New(), Name: "myPc"}
	s.Create(&as)

	return c.JSON(http.StatusCreated, as)

}

func findAsset(c echo.Context) error {
	id := c.Param("id")
	myid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	s := c.Get("svc").(service.AssetSvc)
	as, err := s.Get(myid)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, as)
}

func listAssets(c echo.Context) error {
	// lock.Lock()
	// defer lock.Unlock()
	s := c.Get("svc").(service.AssetSvc)
	as, _ := s.List()
	return c.JSON(http.StatusOK, as)
}

func deleteAsset(c echo.Context) error {
	id := c.Param("id")
	myid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	s := c.Get("svc").(service.AssetSvc)
	err = s.Delete(myid)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, myid.String())

}
