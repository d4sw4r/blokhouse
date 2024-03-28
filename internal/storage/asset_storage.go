package storage

import (
	"errors"

	"github.com/d4sw4r/blokhouse/internal/models"
	"github.com/google/uuid"
)

type MemoryStorage struct {
	Assets map[uuid.UUID]*models.Asset
}

func NewMemoryStorage() MemoryStorage {
	return MemoryStorage{
		Assets: make(map[uuid.UUID]*models.Asset),
	}
}

func (m MemoryStorage) Get(id uuid.UUID) (*models.Asset, error) {
	as, exists := m.Assets[id]
	if !exists {
		return nil, errors.New("no asset found with id")
	}
	return as, nil
}

func (m MemoryStorage) List() ([]*models.Asset, error) {
	as := []*models.Asset{}
	for _, a := range m.Assets {

		as = append(as, a)

	}
	return as, nil
}

func (m MemoryStorage) Create(as *models.Asset) error {
	m.Assets[as.Id] = as
	return nil
}

func (m MemoryStorage) Delete(id uuid.UUID) error {
	delete(m.Assets, id)
	return nil
}
