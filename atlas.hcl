data "external_schema" "gorm" {
  program = [
    "go",
    "run",
    "-mod=mod",
    "ariga.io/atlas-provider-gorm",
    "load",
    "--path", "./internal/model",
    "--dialect", "postgres",
  ]
}

env "local" {
  src     = data.external_schema.gorm.url
  # ponytail: assumes DB_URL is a postgres:// URL that already has a query string
  url     = "${getenv("DB_URL")}&search_path=public"
  exclude = ["schema_migrations"]
  dev = "docker://postgres/17/dev?search_path=public"
  migration {
    dir    = "file://migrations"
    format = golang-migrate
  }
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}
