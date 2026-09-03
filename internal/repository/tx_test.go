package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestWithTransaction_rollsBackOnError(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	type item struct {
		ID   uint `gorm:"primaryKey"`
		Name string
	}
	require.NoError(t, db.AutoMigrate(&item{}))

	err = WithTransaction(context.Background(), db, func(ctx context.Context) error {
		require.NoError(t, DB(ctx, db).Create(&item{Name: "first"}).Error)
		return assert.AnError
	})
	require.Error(t, err)

	var count int64
	require.NoError(t, db.Model(&item{}).Count(&count).Error)
	assert.Equal(t, int64(0), count)
}

func TestWithTransaction_reusesExistingTx(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	type item struct {
		ID   uint `gorm:"primaryKey"`
		Name string
	}
	require.NoError(t, db.AutoMigrate(&item{}))

	var nestedCalled bool
	err = WithTransaction(context.Background(), db, func(ctx context.Context) error {
		require.NoError(t, DB(ctx, db).Create(&item{Name: "outer"}).Error)

		return WithTransaction(ctx, db, func(ctx context.Context) error {
			nestedCalled = true
			require.NoError(t, DB(ctx, db).Create(&item{Name: "inner"}).Error)
			return nil
		})
	})
	require.NoError(t, err)
	assert.True(t, nestedCalled)

	var count int64
	require.NoError(t, db.Model(&item{}).Count(&count).Error)
	assert.Equal(t, int64(2), count)
}

func TestDB_usesTxFromContext(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	type item struct {
		ID   uint `gorm:"primaryKey"`
		Name string
	}
	require.NoError(t, db.AutoMigrate(&item{}))

	err = WithTransaction(context.Background(), db, func(ctx context.Context) error {
		txDB := DB(ctx, db)
		require.NoError(t, txDB.Create(&item{Name: "via-context"}).Error)
		return nil
	})
	require.NoError(t, err)

	var count int64
	require.NoError(t, db.Model(&item{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}
