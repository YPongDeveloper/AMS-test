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

	pool, err := repository.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal("DB: ", err)
	}
	if err := repository.Migrate(ctx, pool); err != nil {
		log.Fatal("migrate: ", err)
	}
	log.Println("DB connected + schema ready")

	hub := ws.NewHub()
	authSvc := service.NewAuthService(
		repository.NewUserRepository(pool),
		repository.NewRefreshTokenRepository(pool),
		cfg.JWTSecret,
		cfg.LineChannelID,
	)
	userSvc := service.NewUserService(repository.NewUserRepository(pool))
	lineNotifier := service.NewLineNotifier(cfg.LineChannelAccessToken, cfg.LiffID)
	taskSvc := service.NewTaskService(
		repository.NewTaskRepository(pool),
		repository.NewUserRepository(pool),
		hub,
		lineNotifier,
	)

	handler := router.New(struct {
		Secret         string
		AllowedOrigins []string
	}{cfg.JWTSecret, cfg.AllowedOrigins}, authSvc, userSvc, taskSvc, hub)

	log.Println("AMS backend listening on :" + cfg.Port)
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Fatal(srv.ListenAndServe())
}
