package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"ams-backend/internal/model"
)

type TeamRepository struct {
	db *pgxpool.Pool
}

func NewTeamRepository(db *pgxpool.Pool) *TeamRepository {
	return &TeamRepository{db: db}
}

const teamCols = `
tm.id, tm.supervisor_id, sup.public_id, sup.display_name,
tm.subordinate_id, sub.public_id, sub.display_name, COALESCE(sub.username, ''),
tm.status, tm.invited_at, tm.responded_at
`

const teamFrom = `
FROM team_members tm
JOIN users sup ON sup.id = tm.supervisor_id
JOIN users sub ON sub.id = tm.subordinate_id
`

func scanTeamMember(row interface{ Scan(...any) error }) (*model.TeamMember, error) {
	var m model.TeamMember
	var respAt *time.Time
	err := row.Scan(
		&m.ID, &m.SupervisorID, &m.SupervisorPublicID, &m.SupervisorName,
		&m.SubordinateID, &m.SubordinatePublicID, &m.SubordinateName, &m.SubordinateUsername,
		&m.Status, &m.InvitedAt, &respAt,
	)
	if err != nil {
		return nil, err
	}
	m.RespondedAt = respAt
	return &m, nil
}

func (r *TeamRepository) FindMembership(ctx context.Context, supervisorID, subordinateID int64) (*model.TeamMember, error) {
	row := r.db.QueryRow(ctx, `
		SELECT `+teamCols+teamFrom+`
		WHERE tm.supervisor_id = $1 AND tm.subordinate_id = $2
	`, supervisorID, subordinateID)
	m, err := scanTeamMember(row)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (r *TeamRepository) Invite(ctx context.Context, supervisorID, subordinateID int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO team_members (supervisor_id, subordinate_id, status, invited_at, responded_at)
		VALUES ($1, $2, 'pending', now(), NULL)
		ON CONFLICT (supervisor_id, subordinate_id)
		DO UPDATE SET status = 'pending', invited_at = now(), responded_at = NULL
	`, supervisorID, subordinateID)
	return err
}

func (r *TeamRepository) ListBySupervisor(ctx context.Context, supervisorID int64) ([]model.TeamMember, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+teamCols+teamFrom+`
		WHERE tm.supervisor_id = $1
		ORDER BY tm.invited_at DESC
	`, supervisorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.TeamMember, 0)
	for rows.Next() {
		m, err := scanTeamMember(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *m)
	}
	return list, nil
}

func (r *TeamRepository) ListInvitationsForSubordinate(ctx context.Context, subordinateID int64) ([]model.TeamMember, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+teamCols+teamFrom+`
		WHERE tm.subordinate_id = $1 AND tm.status = 'pending'
		ORDER BY tm.invited_at DESC
	`, subordinateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.TeamMember, 0)
	for rows.Next() {
		m, err := scanTeamMember(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *m)
	}
	return list, nil
}

func (r *TeamRepository) Respond(ctx context.Context, supervisorID, subordinateID int64, status string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE team_members
		SET status = $1, responded_at = now()
		WHERE supervisor_id = $2 AND subordinate_id = $3
	`, status, supervisorID, subordinateID)
	return err
}

func (r *TeamRepository) RemoveMember(ctx context.Context, supervisorID, subordinateID int64) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM team_members
		WHERE supervisor_id = $1 AND subordinate_id = $2
	`, supervisorID, subordinateID)
	return err
}
