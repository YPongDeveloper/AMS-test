package router

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"ams-backend/internal/handler"
	"ams-backend/internal/middleware"
	"ams-backend/internal/repository"
	"ams-backend/internal/service"
	"ams-backend/internal/ws"
)

type Deps struct {
	Secret          string
	AllowedOrigins  []string
	Pool            *pgxpool.Pool
	RateLimitPerMin int
	RateLimitBurst  int
	MaxBodySize     int64
}

func New(deps Deps, auth *service.AuthService, users *service.UserService, tasks *service.TaskService, team *service.TeamService, reqs *service.RequestService, hub *ws.Hub, dash *repository.DashboardRepository, lands *service.LandService, bldgs *service.BuildingService) http.Handler {
	authH := handler.NewAuthHandler(auth)
	userH := handler.NewUserHandler(users)
	taskH := handler.NewTaskHandler(tasks)
	teamH := handler.NewTeamHandler(team)
	reqH := handler.NewRequestHandler(reqs)
	dashH := handler.NewDashboardHandler(dash)
	landH := handler.NewLandHandler(lands)
	bldgH := handler.NewBuildingHandler(bldgs)
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
	adminOnly := func(h http.HandlerFunc) http.Handler {
		return middleware.Auth(deps.Secret)(middleware.RequireRole("admin", h))
	}
	authed := func(h http.HandlerFunc) http.Handler {
		return middleware.Auth(deps.Secret)(h)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		stats := repository.GetPoolStats(deps.Pool)
		handler.WriteOK(w, http.StatusOK, "ok", map[string]any{
			"status":     "healthy",
			"pool_stats": stats,
		})
	})
	mux.HandleFunc("POST /api/auth/login", authH.LoginPassword)
	mux.HandleFunc("POST /api/auth/refresh", authH.Refresh)
	mux.HandleFunc("POST /api/auth/logout", authH.Logout)
	mux.Handle("GET /api/me", authed(authH.Me))
	mux.Handle("GET /api/users", manage(userH.List))
	mux.Handle("POST /api/users", adminOnly(userH.Create))
	mux.Handle("PUT /api/users/{public_id}", adminOnly(userH.Update))
	mux.Handle("POST /api/users/{public_id}/password", adminOnly(userH.ResetPassword))
	mux.Handle("PATCH /api/users/{public_id}/status", adminOnly(userH.SetStatus))
	mux.Handle("PATCH /api/users/{public_id}/role", manage(userH.ChangeRole))

	// Tasks API
	mux.Handle("GET /api/tasks", authed(taskH.List))
	mux.Handle("POST /api/tasks", middleware.Auth(deps.Secret)(middleware.RequireAnyRole("supervisor", "admin")(http.HandlerFunc(taskH.Create))))
	mux.Handle("PATCH /api/tasks/{public_id}/status", authed(taskH.UpdateStatus))
	mux.Handle("POST /api/tasks/{public_id}/submit", authed(taskH.Submit))
	mux.Handle("POST /api/tasks/{public_id}/review", manage(taskH.Review))

	// Team Management API
	mux.Handle("POST /api/team/invite", manage(teamH.Invite))
	mux.Handle("GET /api/team/members", manage(teamH.MyTeam))
	mux.Handle("GET /api/team/invitations", authed(teamH.MyInvitations))
	mux.Handle("POST /api/team/respond", authed(teamH.Respond))
	mux.Handle("DELETE /api/team/{public_id}", manage(teamH.Remove))

	// Accountant Revision Requests API
	mux.Handle("POST /api/requests", authed(reqH.Create))
	mux.Handle("GET /api/requests", authed(reqH.List))
	mux.Handle("POST /api/requests/{public_id}/assign", manage(reqH.Assign))

	mux.Handle("GET /api/dashboard", authed(dashH.Get))

	// Land Parcels API
	mux.Handle("GET /api/lands", authed(landH.List))
	mux.Handle("GET /api/lands/{public_id}", authed(landH.Get))
	mux.Handle("POST /api/lands", authed(landH.Create))
	mux.Handle("PUT /api/lands/{public_id}", authed(landH.Update))
	mux.Handle("DELETE /api/lands/{public_id}", manage(landH.Delete))

	// Buildings API
	mux.Handle("GET /api/buildings", authed(bldgH.List))
	mux.Handle("GET /api/buildings/{public_id}", authed(bldgH.Get))
	mux.Handle("POST /api/buildings", authed(bldgH.Create))
	mux.Handle("PUT /api/buildings/{public_id}", authed(bldgH.Update))
	mux.Handle("DELETE /api/buildings/{public_id}", manage(bldgH.Delete))

	mux.HandleFunc("GET /ws", wsH.Serve)

	// Rate Limiter for DDoS mitigation
	rateLimiter := middleware.NewRateLimiter(deps.RateLimitPerMin, deps.RateLimitBurst)

	// Pipeline: Recoverer -> RequestLogging -> CORS -> SecurityHeaders -> MaxBodySize -> RateLimiter -> SQLInjectionSanitizer -> Mux
	var chain http.Handler = mux
	chain = middleware.SQLInjectionSanitizer(chain)
	chain = rateLimiter.Middleware(chain)
	chain = middleware.MaxBodySize(deps.MaxBodySize)(chain)
	chain = middleware.SecurityHeaders(chain)
	chain = middleware.CORS(deps.AllowedOrigins, chain)
	chain = middleware.RequestLogging(chain)
	chain = middleware.Recoverer(chain)

	return chain
}

