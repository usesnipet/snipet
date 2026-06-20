package organization

type CreateOrganizationDTO struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type UpdateOrganizationDTO struct {
	Name string `json:"name"`
}
