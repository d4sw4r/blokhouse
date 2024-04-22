package service

import (
	"github.com/d4sw4r/blokhouse/internal/models"
	"github.com/google/uuid"
)

type AssetSvc struct {
	DB models.AssetDB
}

func NewAssetSvc(db models.AssetDB) AssetSvc {
	return AssetSvc{DB: db}
}

func (s *AssetSvc) Get(id uuid.UUID) (*models.Asset, error) {
	as, err := s.DB.Get(id)
	return as, err
}
func (s *AssetSvc) List() ([]*models.Asset, error) {
	as, err := s.DB.List()
	return as, err
}
func (s *AssetSvc) Create(p *models.Asset) error {
	err := s.DB.Create(p)
	return err
}
func (s *AssetSvc) Delete(id uuid.UUID) error {
	err := s.DB.Delete(id)
	return err
}
