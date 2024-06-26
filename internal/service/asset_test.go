package service

import (
	"testing"

	"github.com/d4sw4r/blokhouse/internal/models"
	"github.com/d4sw4r/blokhouse/internal/storage"
	"github.com/google/uuid"
)

var svc = NewAssetSvc(storage.NewMemoryStorage())

func TestCreate(t *testing.T) {
	err := svc.Create(&models.Asset{})
	if err != nil {
		t.Error(err)
	}
}

func TestGet(t *testing.T) {
	_, err := svc.Get(uuid.New())
	if err == nil {
		t.Error("should be an error")
	}
}

func TestList(t *testing.T) {
	_, err := svc.List()
	if err != nil {
		t.Error("should be an error")
	}
}

func TestDelete(t *testing.T) {
	err := svc.Delete(uuid.New())
	if err != nil {
		t.Error("should be an error")
	}
}
