package repository

import (
	"context"

	"gorm.io/gorm"
)

type txKey struct{}

type TxManager struct {
	db *gorm.DB
}

func NewTxManager(db *gorm.DB) ITxManager {
	return &TxManager{db: db}
}

func (m *TxManager) WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return WithTransaction(ctx, m.db, fn)
}

func WithTransaction(ctx context.Context, db *gorm.DB, fn func(ctx context.Context) error) error {
	if tx, ok := ctx.Value(txKey{}).(*gorm.DB); ok && tx != nil {
		return fn(ctx)
	}

	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(WithTx(ctx, tx))
	})
}

func WithTx(ctx context.Context, tx *gorm.DB) context.Context {
	return context.WithValue(ctx, txKey{}, tx)
}

func DB(ctx context.Context, db *gorm.DB) *gorm.DB {
	if tx, ok := GetTx(ctx); ok && tx != nil {
		return tx.WithContext(ctx)
	}
	return db.WithContext(ctx)
}

func GetTx(ctx context.Context) (*gorm.DB, bool) {
	tx, ok := ctx.Value(txKey{}).(*gorm.DB)
	return tx, ok
}
