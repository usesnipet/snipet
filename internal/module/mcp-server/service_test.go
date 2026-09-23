package mcpserver_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/mcp"
	"github.com/usesnipet/snipet/internal/model"
	mcpserver "github.com/usesnipet/snipet/internal/module/mcp-server"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/internal/repository/mocks"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

type fakeSyncer struct{ ids []string }

func (f *fakeSyncer) Enqueue(id string) { f.ids = append(f.ids, id) }

func newTestService(repo repository.IMcpServerRepository, registry *mcp.Registry) *mcpserver.Service {
	return mcpserver.NewService(repo, registry, &fakeSyncer{})
}

func TestCreatePersistsEntity(t *testing.T) {
	t.Parallel()

	var stored *model.McpServer
	repo := mocks.NewMockIMcpServerRepository(t)
	registry := mcp.NewRegistry()
	repo.EXPECT().
		Create(mock.Anything, mock.Anything).
		Run(func(ctx context.Context, server *model.McpServer) {
			stored = server
			server.ID = uuid.New().String()
		}).
		Return(nil)

	svc := newTestService(repo, registry)
	result, err := svc.Create(context.Background(), mcpserver.CreateMcpServerDTO{
		Name:      "Local stdio server",
		Transport: mcp.TransportStdIO,
		Config:    jsonx.JSONMap{"command": "npx"},
	})

	require.NoError(t, err)
	assert.Equal(t, stored, result)
	assert.Equal(t, mcp.TransportStdIO, result.Transport)
}

func TestCreateEnqueuesSync(t *testing.T) {
	t.Parallel()

	repo := mocks.NewMockIMcpServerRepository(t)
	repo.EXPECT().
		Create(mock.Anything, mock.Anything).
		Run(func(ctx context.Context, server *model.McpServer) { server.ID = "id-1" }).
		Return(nil)

	syncer := &fakeSyncer{}
	svc := mcpserver.NewService(repo, mcp.NewRegistry(), syncer)
	_, err := svc.Create(context.Background(), mcpserver.CreateMcpServerDTO{
		Name:      "Local stdio server",
		Transport: mcp.TransportStdIO,
		Config:    jsonx.JSONMap{"command": "npx"},
	})

	require.NoError(t, err)
	assert.Equal(t, []string{"id-1"}, syncer.ids)
}

func TestUpdateEnqueuesSyncOnlyWhenConnectionChanges(t *testing.T) {
	t.Parallel()

	repo := mocks.NewMockIMcpServerRepository(t)
	repo.EXPECT().
		FindByID(mock.Anything, "id-1").
		Return(&model.McpServer{ID: "id-1", Transport: mcp.TransportStdIO, Config: jsonx.JSONMap{"command": "npx"}}, nil)
	repo.EXPECT().UpdateByID(mock.Anything, "id-1", mock.Anything).Return(nil)

	syncer := &fakeSyncer{}
	svc := mcpserver.NewService(repo, mcp.NewRegistry(), syncer)

	name := "renamed"
	require.NoError(t, svc.Update(context.Background(), "id-1", mcpserver.UpdateMcpServerDTO{Name: &name}))
	assert.Empty(t, syncer.ids)

	require.NoError(t, svc.Update(context.Background(), "id-1", mcpserver.UpdateMcpServerDTO{Config: jsonx.JSONMap{"command": "uvx"}}))
	assert.Equal(t, []string{"id-1"}, syncer.ids)
}

func TestCreateRejectsConfigNotMatchingTransport(t *testing.T) {
	t.Parallel()

	svc := newTestService(mocks.NewMockIMcpServerRepository(t), mcp.NewRegistry())
	_, err := svc.Create(context.Background(), mcpserver.CreateMcpServerDTO{
		Name:      "Remote server",
		Transport: mcp.TransportHTTP,
		Config:    jsonx.JSONMap{"command": "npx"},
	})

	var appErr *apperr.Error
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, 400, appErr.StatusCode)
}

func TestUpdateValidatesConfigAgainstStoredTransport(t *testing.T) {
	t.Parallel()

	repo := mocks.NewMockIMcpServerRepository(t)
	repo.EXPECT().
		FindByID(mock.Anything, "id-1").
		Return(&model.McpServer{ID: "id-1", Transport: mcp.TransportHTTP, Config: jsonx.JSONMap{"url": "https://example.com"}}, nil)

	svc := newTestService(repo, mcp.NewRegistry())
	err := svc.Update(context.Background(), "id-1", mcpserver.UpdateMcpServerDTO{
		Config: jsonx.JSONMap{"command": "npx"},
	})

	var appErr *apperr.Error
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, 400, appErr.StatusCode)
}

func TestUpdateNotFoundReturnsAppError(t *testing.T) {
	t.Parallel()

	repo := mocks.NewMockIMcpServerRepository(t)
	registry := mcp.NewRegistry()
	repo.EXPECT().
		FindByID(mock.Anything, "missing").
		Return(nil, apperr.NotFound("entity not found"))

	svc := newTestService(repo, registry)
	name := "renamed"
	err := svc.Update(context.Background(), "missing", mcpserver.UpdateMcpServerDTO{Name: &name})

	var appErr *apperr.Error
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, 404, appErr.StatusCode)
}

func TestDeleteByIDDelegatesToRepository(t *testing.T) {
	t.Parallel()

	repo := mocks.NewMockIMcpServerRepository(t)
	registry := mcp.NewRegistry()
	repo.EXPECT().DeleteByID(mock.Anything, "id-1").Return(nil)

	svc := newTestService(repo, registry)
	require.NoError(t, svc.DeleteByID(context.Background(), "id-1"))
}

func TestListRegistryReturnsBuiltInsSortedByKey(t *testing.T) {
	t.Parallel()

	svc := newTestService(mocks.NewMockIMcpServerRepository(t), mcp.NewRegistry())
	items := svc.ListRegistry()

	require.NotEmpty(t, items)
	for i := 1; i < len(items); i++ {
		assert.Less(t, items[i-1].Key, items[i].Key)
	}
}

func TestGetRegistryItem(t *testing.T) {
	t.Parallel()

	svc := newTestService(mocks.NewMockIMcpServerRepository(t), mcp.NewRegistry())

	item, err := svc.GetRegistryItem("filesystem")
	require.NoError(t, err)
	assert.Equal(t, mcp.TransportStdIO, item.Transport)

	_, err = svc.GetRegistryItem("missing")
	var appErr *apperr.Error
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, 404, appErr.StatusCode)
}
