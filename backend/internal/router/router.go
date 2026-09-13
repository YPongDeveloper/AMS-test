package router

import (
	"net/http"

	"ams-backend/internal/handler"
	"ams-backend/internal/middleware"
	"ams-backend/internal/service"
	"ams-backend/internal/ws"
)

func New(cfgCfg struct {
	Secret         string
	AllowedOrigins []string
}, auth *service.AuthService, users *service.UserService, tasks *service.TaskService, hub *ws.Hub) http.Handler {
	authH := handler.NewAuthHandler(auth)
	userH := handler.NewUserHandler(users)
	taskH := handler.NewTaskHandler(tasks)
	wsH := ws.NewHandler(hub, func(token string) (*ws.Identity, error) {
		c, err := service.ParseAccessToken(cfgCfg.Secret, token)
		if err != nil {
			return nil, err
		}
		return &ws.Identity{UserID: c.UserID}, nil
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		handler.WriteOK(w, http.StatusOK, "ok", nil)
	})
	mux.HandleFunc("POST /api/auth/line", authH.Login)
	mux.HandleFunc("POST /api/auth/refresh", authH.Refresh)
	mux.HandleFunc("POST /api/auth/logout", authH.Logout)
	mux.Handle("GET /api/me", middleware.Auth(cfgCfg.Secret)(http.HandlerFunc(authH.Me)))
	mux.Handle("GET /api/users", middleware.Auth(cfgCfg.Secret)(middleware.RequireRole("supervisor", http.HandlerFunc(userH.List))))
	mux.Handle("PATCH /api/users/{public_id}/role", middleware.Auth(cfgCfg.Secret)(middleware.RequireRole("supervisor", http.HandlerFunc(userH.ChangeRole))))
	mux.Handle("GET /api/tasks", middleware.Auth(cfgCfg.Secret)(http.HandlerFunc(taskH.List)))
	mux.Handle("POST /api/tasks", middleware.Auth(cfgCfg.Secret)(middleware.RequireRole("supervisor", http.HandlerFunc(taskH.Create))))
	mux.Handle("PATCH /api/tasks/{public_id}/status", middleware.Auth(cfgCfg.Secret)(http.HandlerFunc(taskH.UpdateStatus)))
	mux.HandleFunc("GET /ws", wsH.Serve)

	return middleware.CORS(cfgCfg.AllowedOrigins, mux)
}
