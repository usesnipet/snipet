package tool_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/internal/module/tool"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/internal/repository/mocks"
)

func newTestService(repo repository.IToolRepository) *tool.Service {
	return tool.NewService(repo)
}

func TestDeleteByIDDelegatesToRepository(t *testing.T) {
	t.Parallel()

	repo := mocks.NewMockIToolRepository(t)
	repo.EXPECT().DeleteByID(mock.Anything, "id-1").Return(nil)

	svc := newTestService(repo)
	require.NoError(t, svc.DeleteByID(context.Background(), "id-1"))
}
