package main

// dbcheck — ตรวจ users table หลัง seed (ใช้แล้วลบ)
import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	dsn := "postgresql://postgres.maymctkogrdsvyzdgtmq:SrtAms-2026%21xK9pQz2vB4nM@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		fmt.Println("connect fail:", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	rows, err := conn.Query(ctx, `SELECT id, COALESCE(username,'-'), role, COALESCE(left(password_hash,7),'-'), COALESCE(line_user_id,'-') FROM users ORDER BY id`)
	if err != nil {
		fmt.Println("query fail:", err)
		os.Exit(1)
	}
	defer rows.Close()
	fmt.Println("id | username | role | pwdhash | line")
	for rows.Next() {
		var id int64
		var u, r, p, l string
		_ = rows.Scan(&id, &u, &r, &p, &l)
		fmt.Printf("%d | %s | %s | %s | %s\n", id, u, r, p, l)
	}

	var dashExists bool
	_ = conn.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dashboard_content WHERE key='dashboard')`).Scan(&dashExists)
	fmt.Println("dashboard seeded:", dashExists)
}
