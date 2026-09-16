package model

import "testing"

func TestValidRole(t *testing.T) {
	valid := []string{"admin", "supervisor", "subordinate", "accountant"}
	for _, r := range valid {
		if !ValidRole(r) {
			t.Errorf("Role %q should be valid", r)
		}
	}

	invalid := []string{"hacker", "guest", "root", ""}
	for _, r := range invalid {
		if ValidRole(r) {
			t.Errorf("Role %q should be invalid", r)
		}
	}
}

func TestValidStatus(t *testing.T) {
	valid := []string{
		TaskStatusPending, TaskStatusAccepted, TaskStatusInProgress,
		TaskStatusSubmitted, TaskStatusRevisionRequested, TaskStatusDone, TaskStatusCancelled,
	}
	for _, s := range valid {
		if !ValidStatus(s) {
			t.Errorf("Status %q should be valid", s)
		}
	}

	if ValidStatus("unknown_status") {
		t.Error("unknown_status should be invalid")
	}
}
