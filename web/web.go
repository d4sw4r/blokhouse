package web

import (
	"github.com/d4sw4r/blokhouse/internal/service"
	api "github.com/d4sw4r/blokhouse/web/api/v1"
	"github.com/d4sw4r/blokhouse/web/ui"
	"github.com/labstack/echo-contrib/echoprometheus"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type Server struct {
	ListenAddr   string
	Svc          service.AssetSvc
	DiscoverySvc service.DiscoverySvc
}

func NewServer(ListenAddr string, svc service.AssetSvc) Server {
	return Server{ListenAddr: ListenAddr, Svc: svc}
}

func (s Server) Start() error {
	e := echo.New()
	api := api.NewAPI()
	e.Use(bindApp(s.Svc, s.DiscoverySvc))
	e.GET("/", ui.HandlerIndex)
	e.GET("/dashboard", ui.HandlerDashboard)
	e.GET("/settings", ui.HandlerSettings)
	e.GET("/asset", ui.HandlerAssets)
	e.Use(echoprometheus.NewMiddleware("blockhouse"))
	e.GET("/metrics", echoprometheus.NewHandler())
	e.Use(middleware.Logger())
	// e.Use(middleware.BasicAuthWithConfig(middleware.BasicAuthConfig{
	// 	Validator: authMiddleware,
	// 	Skipper:   mySkipper,
	// }))
	e.Static("/static", "assets")
	g := e.Group("/api")

	g.Use(middleware.BasicAuth(func(username, password string, c echo.Context) (bool, error) {
		if username == "admin" && password == "admin123" {
			return true, nil
		}
		return false, nil
	}))

	e.GET("/api/v1/assets", api.ListAssets)
	e.POST("/api/v1/assets", api.CreateAsset)
	e.GET("/api/v1/assets/:id", api.FindAsset)
	//e.PUT("/assets/:id", updateUser)
	e.DELETE("/api/v1/assets/:id", api.DeleteAsset)

	return e.Start(s.ListenAddr)
}

// func mySkipper(c echo.Context) bool {
// 	if c.Path() == "/" || c.Path() == "/static/*" {
// 		return true
// 	}
// 	return false
// }

// func authMiddleware(username, password string, c echo.Context) (bool, error) {
// 	// Be careful to use constant time comparison to prevent timing attacks
// 	if subtle.ConstantTimeCompare([]byte(username), []byte("admin")) == 1 &&
// 		subtle.ConstantTimeCompare([]byte(password), []byte("admin")) == 1 {
// 		return true, nil
// 	}
// 	return false, nil
// }

func bindApp(assetsvc service.AssetSvc, discoverysvc service.DiscoverySvc) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("assetsvc", assetsvc)
			c.Set("discoverysvc", discoverysvc)
			return next(c)
		}
	}
}
