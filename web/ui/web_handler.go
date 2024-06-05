package ui

import (
	"net/http"

	"github.com/a-h/templ"
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

func IndexHandler(c echo.Context) error {
	return Render(c, http.StatusOK, ui.Index())
}
