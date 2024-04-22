package storage

import (
	"testing"

	"github.com/d4sw4r/blokhouse/internal/models"
	"github.com/google/uuid"
)

var testid = uuid.New()
var storage = NewMemoryStorage()

func CreateTest(t *testing.T) {
	asset := &models.Asset{Id: testid, Name: "test1"}
	err := storage.Create(asset)
	if err != nil {
		t.Error(err)
	}
}

func GetTest(t *testing.T) {
	asset, err := storage.Get(testid)
	if err != nil {
		t.Error(err)
	}
	if asset.Name != "test1" {
		t.Errorf("should be test1 got: %s", asset.Name)
	}
}

func ListTest(t *testing.T) {
	asset, err := storage.List()
	if err != nil {
		t.Error(err)
	}
	if len(asset) != 1 {
		t.Errorf("should be 1 got: %d", len(asset))
	}

}

func DeleteTest(t *testing.T) {
	err := storage.Delete(testid)
	if err != nil {
		t.Error(err)
	}
	if len(storage.Assets) != 0 {
		t.Fatalf("size of assets should be 0 is %d", len(storage.Assets))
	}
}
