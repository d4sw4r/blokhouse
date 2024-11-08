package models

import "github.com/google/uuid"

type DiscoveryTarget struct {
	ID   uuid.UUID
	Name string
	IP   string
	Mac  string
}
