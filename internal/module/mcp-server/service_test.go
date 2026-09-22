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

func newTestService(repo repository.IMcpServerRepository, registry *mcp.Registry) *mcpserver.Service {
	return mcpserver.NewService(repo, registry)
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
