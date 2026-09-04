package apikey_test

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/logger"
	"github.com/usesnipet/snipet/internal/model"
	apikey "github.com/usesnipet/snipet/internal/module/api-key"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/internal/repository/mocks"
)

func newTestService(repo repository.IApiKeyRepository) *apikey.Service {
	return apikey.NewService(
		logger.NewLogger(logger.LevelError),
		repo,
		auth.NewAPIKeyGenerator(),
		auth.NewKeyHasher(),
	)
}

func assertAppError(t *testing.T, err error, statusCode int, message string) {
	t.Helper()
	var appErr *apperr.Error
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, statusCode, appErr.StatusCode)
	assert.Equal(t, message, appErr.Message)
}

func TestCreateStoresHashedKeyAndReturnsSecret(t *testing.T) {
	t.Parallel()

	var stored *model.APIKey
	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		Create(mock.Anything, mock.Anything).
		Run(func(ctx context.Context, apiKey *model.APIKey) {
			stored = apiKey
			apiKey.ID = uuid.New().String()
		}).
		Return(nil)

	svc := newTestService(repo)

	expiresAt := time.Now().Add(24 * time.Hour)
	result, err := svc.Create(context.Background(), apikey.CreateAPIKeyDTO{
		Name:      "Test Key",
		ExpiresAt: &expiresAt,
	})
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, "Test Key", result.Name)
	assert.True(t, result.Active)
	assert.Equal(t, expiresAt, *result.ExpiresAt)
	assert.NotEmpty(t, result.Key)
	assert.True(t, auth.NewAPIKeyGenerator().ValidateFormat(result.Key))

	require.NotNil(t, stored)
	assert.Equal(t, result.KeyID, stored.KeyID)
	assert.NotEqual(t, result.Key, stored.Key)

	valid, err := auth.NewKeyHasher().Verify(result.Key, stored.Key)
	require.NoError(t, err)
	assert.True(t, valid)
	assert.True(t, stored.Active)
}

func TestVerifyAPIKeyAcceptsValidKey(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	hasher := auth.NewKeyHasher()
	plainKey, keyID, err := generator.Generate()
	require.NoError(t, err)

	hash, err := hasher.Hash(plainKey)
	require.NoError(t, err)

	stored := model.APIKey{
		ID:     uuid.New().String(),
		Name:   "Valid Key",
		KeyID:  keyID,
		Key:    hash,
		Active: true,
	}

	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		Filter(mock.Anything, mock.Anything).
		Run(func(_ context.Context, opts *filter.Options[model.APIKey]) {
			keyFilter, ok := opts.Where.Fields["key_id"]
			require.True(t, ok)
			assert.Equal(t, filter.WhereOperatorEqual, keyFilter.Operator)
			assert.Equal(t, []any{keyID}, keyFilter.Value)
		}).
		Return(page.NewPaginated([]model.APIKey{stored}, 1, 0, 1), nil)

	svc := apikey.NewService(logger.NewLogger(logger.LevelError), repo, generator, hasher)

	result, err := svc.VerifyAPIKey(context.Background(), plainKey)
	require.NoError(t, err)
	assert.Equal(t, stored.ID, result.ID)
}

func TestVerifyAPIKeyRejectsRepositoryError(t *testing.T) {
	t.Parallel()

	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		Filter(mock.Anything, mock.Anything).
		Return(nil, errors.New("database unavailable"))

	svc := newTestService(repo)

	_, err := svc.VerifyAPIKey(context.Background(), "sn_anything")
	assertAppError(t, err, http.StatusUnauthorized, "invalid api key")
}

func TestVerifyAPIKeyRejectsMissingKey(t *testing.T) {
	t.Parallel()

	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		Filter(mock.Anything, mock.Anything).
		Return(page.NewPaginated([]model.APIKey{}, 0, 0, 0), nil)

	svc := newTestService(repo)

	_, err := svc.VerifyAPIKey(context.Background(), "sn_anything")
	assertAppError(t, err, http.StatusNotFound, "api key not found")
}

func TestVerifyAPIKeyRejectsInactiveKey(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	hasher := auth.NewKeyHasher()
	plainKey, keyID, err := generator.Generate()
	require.NoError(t, err)

	hash, err := hasher.Hash(plainKey)
	require.NoError(t, err)

	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		Filter(mock.Anything, mock.Anything).
		Return(page.NewPaginated([]model.APIKey{{
			KeyID:  keyID,
			Key:    hash,
			Active: false,
		}}, 1, 0, 1), nil)

	svc := apikey.NewService(logger.NewLogger(logger.LevelError), repo, generator, hasher)

	_, err = svc.VerifyAPIKey(context.Background(), plainKey)
	assertAppError(t, err, http.StatusForbidden, "api key is disabled")
}

func TestVerifyAPIKeyRejectsExpiredKey(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	hasher := auth.NewKeyHasher()
	plainKey, keyID, err := generator.Generate()
	require.NoError(t, err)

	hash, err := hasher.Hash(plainKey)
	require.NoError(t, err)

	expiredAt := time.Now().Add(-time.Hour)
	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		Filter(mock.Anything, mock.Anything).
		Return(page.NewPaginated([]model.APIKey{{
			KeyID:     keyID,
			Key:       hash,
			Active:    true,
			ExpiresAt: &expiredAt,
		}}, 1, 0, 1), nil)

	svc := apikey.NewService(logger.NewLogger(logger.LevelError), repo, generator, hasher)

	_, err = svc.VerifyAPIKey(context.Background(), plainKey)
	assertAppError(t, err, http.StatusForbidden, "api key is expired")
}

func TestVerifyAPIKeyRejectsWrongSecret(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	hasher := auth.NewKeyHasher()
	plainKey, keyID, err := generator.Generate()
	require.NoError(t, err)

	wrongKey, _, err := generator.Generate()
	require.NoError(t, err)

	hash, err := hasher.Hash(plainKey)
	require.NoError(t, err)

	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		Filter(mock.Anything, mock.Anything).
		Return(page.NewPaginated([]model.APIKey{{
			KeyID:  keyID,
			Key:    hash,
			Active: true,
		}}, 1, 0, 1), nil)

	svc := apikey.NewService(logger.NewLogger(logger.LevelError), repo, generator, hasher)

	_, err = svc.VerifyAPIKey(context.Background(), wrongKey)
	assertAppError(t, err, http.StatusUnauthorized, "invalid api key")
}

func TestFilterDelegatesToRepository(t *testing.T) {
	t.Parallel()

	expected := page.NewPaginated([]model.APIKey{{Name: "A"}}, 1, 0, 10)
	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		Filter(mock.Anything, mock.Anything).
		Run(func(_ context.Context, opts *filter.Options[model.APIKey]) {
			assert.Equal(t, filter.Default[model.APIKey]().Take, opts.Take)
		}).
		Return(expected, nil)

	svc := newTestService(repo)

	result, err := svc.Filter(context.Background(), filter.Default[model.APIKey]())
	require.NoError(t, err)
	assert.Equal(t, expected, result)
}

func TestFindByIDDelegatesToRepository(t *testing.T) {
	t.Parallel()

	id := uuid.New().String()
	expected := &model.APIKey{ID: id, Name: "Found"}
	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		FindByID(mock.Anything, id).
		Return(expected, nil)

	svc := newTestService(repo)

	result, err := svc.FindByID(context.Background(), id)
	require.NoError(t, err)
	assert.Equal(t, expected, result)
}

func TestMeReturnsAuthenticatedAPIKey(t *testing.T) {
	t.Parallel()

	id := uuid.New().String()
	expected := &model.APIKey{ID: id, Name: "Current Key"}
	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		FindByID(mock.Anything, id).
		Return(expected, nil)

	svc := newTestService(repo)
	ctx := auth.SetApiKeyIdentity(context.Background(), auth.ApiKeyIdentity{APIKeyID: id})

	result, err := svc.Me(ctx)
	require.NoError(t, err)
	assert.Equal(t, expected, result)
}

func TestMeRejectsMissingIdentity(t *testing.T) {
	t.Parallel()

	svc := newTestService(mocks.NewMockIApiKeyRepository(t))

	_, err := svc.Me(context.Background())
	assertAppError(t, err, http.StatusUnauthorized, "unauthorized")
}

func TestRollUpdatesKeyAndReturnsNewSecret(t *testing.T) {
	t.Parallel()

	id := uuid.New().String()
	existing := &model.APIKey{ID: id, Name: "Rollable", KeyID: "old-key-id", Key: "old-hash"}
	findCalls := 0
	var updatedKeyID, updatedHash string

	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		FindByID(mock.Anything, id).
		RunAndReturn(func(_ context.Context, gotID string) (*model.APIKey, error) {
			assert.Equal(t, id, gotID)
			findCalls++
			return &model.APIKey{
				ID:    id,
				Name:  existing.Name,
				KeyID: existing.KeyID,
				Key:   existing.Key,
			}, nil
		}).
		Times(1)
	repo.EXPECT().
		UpdateByID(mock.Anything, id, mock.Anything).
		Run(func(_ context.Context, gotID string, updates *model.APIKey) {
			assert.Equal(t, id, gotID)
			updatedKeyID = updates.KeyID
			updatedHash = updates.Key
			existing.KeyID = updates.KeyID
			existing.Key = updates.Key
		}).
		Return(nil)

	svc := newTestService(repo)

	result, err := svc.Roll(context.Background(), id)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, id, result.ID)
	assert.NotEmpty(t, result.Key)
	assert.Equal(t, updatedKeyID, result.KeyID)
	assert.NotEqual(t, "old-key-id", result.KeyID)
	assert.NotEqual(t, "old-hash", updatedHash)
	assert.Equal(t, 1, findCalls)

	valid, err := auth.NewKeyHasher().Verify(result.Key, updatedHash)
	require.NoError(t, err)
	assert.True(t, valid)
}

func TestRollReturnsErrorWhenKeyNotFound(t *testing.T) {
	t.Parallel()

	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		UpdateByID(mock.Anything, mock.Anything, mock.Anything).
		Return(apperr.NotFound("api key not found"))

	svc := newTestService(repo)

	_, err := svc.Roll(context.Background(), uuid.New().String())
	assertAppError(t, err, http.StatusNotFound, "api key not found")
}

func TestUpdateExpirationDelegatesToRepository(t *testing.T) {
	t.Parallel()

	id := uuid.New().String()
	expiresAt := time.Now().Add(48 * time.Hour)
	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		UpdateExpiration(mock.Anything, id, &expiresAt).
		Return(nil)

	svc := newTestService(repo)

	err := svc.UpdateExpiration(context.Background(), id, apikey.UpdateExpirationDTO{ExpiresAt: &expiresAt})
	require.NoError(t, err)
}

func TestToggleActiveDelegatesToRepository(t *testing.T) {
	t.Parallel()

	id := uuid.New().String()
	repo := mocks.NewMockIApiKeyRepository(t)
	repo.EXPECT().
		ToggleActive(mock.Anything, id, false).
		Return(nil)

	svc := newTestService(repo)

	err := svc.ToggleActive(context.Background(), id, false)
	require.NoError(t, err)
}
