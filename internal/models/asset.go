package models

import "github.com/google/uuid"

type Asset struct {
	Id   uuid.UUID
	Name string
	IP   string

	Type AssetType
}

type AssetType struct {
	Id   int64
	Name string
}

type AssetService interface {
	Get(id uuid.UUID) (*Asset, error)
	List() ([]*Asset, error)
	Create(p *Asset) error
	Delete(id uuid.UUID) error
}

type AssetDB interface {
	Get(id uuid.UUID) (*Asset, error)
	List() ([]*Asset, error)
	Create(p *Asset) error
	Delete(id uuid.UUID) error
}
