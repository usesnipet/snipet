package web

import (
	"embed"
)

var (
	//go:embed dist/*
	Dist embed.FS
)
