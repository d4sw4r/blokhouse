package api

import (
	"crypto/subtle"
	"net/http"

	"github.com/d4sw4r/blokhouse/internal/service"
	"github.com/labstack/echo-contrib/echoprometheus"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type ApiServer struct {
	ListenAddr string
	Svc        service.AssetSvc
}

func NewApiServer(ListenAddr string, svc service.AssetSvc) ApiServer {
	return ApiServer{ListenAddr: ListenAddr, Svc: svc}
}

func (s ApiServer) Start() error {
	e := echo.New()
	e.Use(bindApp(s.Svc))
	e.GET("/", index)
	e.Use(echoprometheus.NewMiddleware("blockhouse"))
	e.GET("/metrics", echoprometheus.NewHandler())
	e.Use(middleware.Logger())
	e.Use(middleware.BasicAuthWithConfig(middleware.BasicAuthConfig{
		Validator: authMiddleware,
		Skipper:   mySkipper,
	}))
	e.Static("/static", "assets")

	e.GET("/assets", listAssets)
	e.POST("/assets", createAsset)
	e.GET("/assets/:id", findAsset)
	//e.PUT("/assets/:id", updateUser)
	e.DELETE("/assets/:id", deleteAsset)

	return e.Start(s.ListenAddr)
}

func index(c echo.Context) error {
	return c.String(http.StatusOK, "Hello, World!")
}

func mySkipper(c echo.Context) bool {
	if c.Path() == "/" || c.Path() == "/static/*" {
		return true
	}
	return false
}

func authMiddleware(username, password string, c echo.Context) (bool, error) {
	// Be careful to use constant time comparison to prevent timing attacks
	if subtle.ConstantTimeCompare([]byte(username), []byte("admin")) == 1 &&
		subtle.ConstantTimeCompare([]byte(password), []byte("admin")) == 1 {
		return true, nil
	}
	return false, nil
}

func bindApp(svc service.AssetSvc) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("svc", svc)
			return next(c)
		}
	}
}
