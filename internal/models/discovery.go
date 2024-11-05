package models

import "github.com/google/uuid"

type DiscoveryTarget struct {
	ID   uuid.UUID
	Name string
	IP   string
	Mac  string
}

type DiscoveryService interface {
	Get(id uuid.UUID) (*DiscoveryTarget, error)
	List() ([]*DiscoveryTarget, error)
	Create(p *DiscoveryTarget) error
	Delete(id uuid.UUID) error
}

type DiscoveryTargetDB interface {
	Get(id uuid.UUID) (*DiscoveryTarget, error)
	List() ([]*DiscoveryTarget, error)
	Create(p *DiscoveryTarget) error
	Delete(id uuid.UUID) error
}
