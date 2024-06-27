package ui

import (
	"net/http"

	"github.com/a-h/templ"
	"github.com/d4sw4r/blokhouse/internal/service"
	ui "github.com/d4sw4r/blokhouse/web/ui/view"
	"github.com/labstack/echo/v4"
)

// This custom Render replaces Echo's echo.Context.Render() with templ's templ.Component.Render().
func Render(ctx echo.Context, statusCode int, t templ.Component) error {
	buf := templ.GetBuffer()
	defer templ.ReleaseBuffer(buf)

	if err := t.Render(ctx.Request().Context(), buf); err != nil {
		return err
	}

	return ctx.HTML(statusCode, buf.String())
}

func HandlerIndex(c echo.Context) error {
	return Render(c, http.StatusOK, ui.Index())
}

func HandlerDashboard(c echo.Context) error {
	return Render(c, http.StatusOK, ui.Dashboard())
}

func HandlerAssets(c echo.Context) error {
	s := c.Get("svc").(service.AssetSvc)
	as, _ := s.List()
	return Render(c, http.StatusOK, ui.Asset(as))
}

func HandlerDiscovery(c echo.Context) error {
	return Render(c, http.StatusOK, ui.Discovery())
}
