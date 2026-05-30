package utils

import (
	"context"
	"net/http"

	"snippet-manager/internal/model"
)

type contextKey string

const (
	UserContextKey contextKey = "current_user"
)

func SetCurrentUser(r *http.Request, user *model.User) *http.Request {
	ctx := context.WithValue(r.Context(), UserContextKey, user)
	return r.WithContext(ctx)
}

func GetCurrentUser(ctx context.Context) *model.User {
	user, ok := ctx.Value(UserContextKey).(*model.User)
	if !ok {
		return nil
	}
	return user
}
