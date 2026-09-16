package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"ams-backend/internal/config"
	"ams-backend/internal/repository"
	"ams-backend/internal/router"
	"ams-backend/internal/service"
	"ams-backend/internal/ws"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := repository.Open(ctx, cfg.DatabaseURL, cfg.DBMaxConns, cfg.DBMinConns)
	if err != nil {
		log.Fatal("DB: ", err)
	}
	if err := repository.Migrate(ctx, pool); err != nil {
		log.Fatal("migrate: ", err)
	}
	repository.Seed(ctx, pool)
	log.Println("DB connected + schema ready")

	hub := ws.NewHub()
	userRepo := repository.NewUserRepository(pool)
	authSvc := service.NewAuthService(userRepo, repository.NewRefreshTokenRepository(pool), cfg.JWTSecret, cfg.LineChannelID)
	userSvc := service.NewUserService(userRepo)
	taskRepo := repository.NewTaskRepository(pool)
	dashRepo := repository.NewDashboardRepository(pool)
	landRepo := repository.NewLandRepository(pool)
	landSvc := service.NewLandService(landRepo)
	bldgRepo := repository.NewBuildingRepository(pool)
	bldgSvc := service.NewBuildingService(bldgRepo)

	taskSvc := service.NewTaskService(taskRepo, userRepo, landRepo, bldgRepo, hub)

	teamRepo := repository.NewTeamRepository(pool)
	teamSvc := service.NewTeamService(teamRepo, userRepo, hub)

	reqRepo := repository.NewRequestRepository(pool)
	reqSvc := service.NewRequestService(reqRepo, taskRepo, hub)

	handler := router.New(router.Deps{
		Secret:          cfg.JWTSecret,
		AllowedOrigins:  cfg.AllowedOrigins,
		Pool:            pool,
		RateLimitPerMin: cfg.RateLimitPerMin,
		RateLimitBurst:  cfg.RateLimitBurst,
		MaxBodySize:     cfg.MaxBodySizeBytes,
	}, authSvc, userSvc, taskSvc, teamSvc, reqSvc, hub, dashRepo, landSvc, bldgSvc)

	log.Println("AMS backend listening on :" + cfg.Port)
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	log.Fatal(srv.ListenAndServe())
}
