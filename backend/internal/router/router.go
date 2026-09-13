package router

import (
	"net/http"

	"ams-backend/internal/handler"
	"ams-backend/internal/middleware"
	"ams-backend/internal/repository"
	"ams-backend/internal/service"
	"ams-backend/internal/ws"
)

type Deps struct {
	Secret         string
	AllowedOrigins []string
}

func New(deps Deps, auth *service.AuthService, users *service.UserService, tasks *service.TaskService, hub *ws.Hub, dash *repository.DashboardRepository) http.Handler {
	authH := handler.NewAuthHandler(auth)
	userH := handler.NewUserHandler(users)
	taskH := handler.NewTaskHandler(tasks)
	dashH := handler.NewDashboardHandler(dash)
	wsH := ws.NewHandler(hub, func(token string) (*ws.Identity, error) {
		c, err := service.ParseAccessToken(deps.Secret, token)
		if err != nil {
			return nil, err
		}
		return &ws.Identity{UserID: c.UserID}, nil
	})

	manage := func(h http.HandlerFunc) http.Handler {
		return middleware.Auth(deps.Secret)(middleware.RequireAnyRole("supervisor", "admin")(h))
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		handler.WriteOK(w, http.StatusOK, "ok", nil)
	})
	mux.HandleFunc("POST /api/auth/line", authH.Login)
	mux.HandleFunc("POST /api/auth/login", authH.LoginPassword)
	mux.HandleFunc("POST /api/auth/refresh", authH.Refresh)
	mux.HandleFunc("POST /api/auth/logout", authH.Logout)
	mux.Handle("GET /api/me", middleware.Auth(deps.Secret)(http.HandlerFunc(authH.Me)))
	mux.Handle("GET /api/users", manage(userH.List))
	mux.Handle("PATCH /api/users/{public_id}/role", manage(userH.ChangeRole))
	mux.Handle("GET /api/tasks", middleware.Auth(deps.Secret)(http.HandlerFunc(taskH.List)))
	mux.Handle("POST /api/tasks", middleware.Auth(deps.Secret)(middleware.RequireRole("supervisor", http.HandlerFunc(taskH.Create))))
	mux.Handle("PATCH /api/tasks/{public_id}/status", middleware.Auth(deps.Secret)(http.HandlerFunc(taskH.UpdateStatus)))
	mux.Handle("GET /api/dashboard", middleware.Auth(deps.Secret)(http.HandlerFunc(dashH.Get)))
	mux.HandleFunc("GET /ws", wsH.Serve)

	return middleware.RequestLogging(middleware.CORS(deps.AllowedOrigins, mux))
}
