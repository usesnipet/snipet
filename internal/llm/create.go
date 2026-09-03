package llm

// CreateProvider builds a Provider from the given Options. Key, TestConnection,
// Stream, and Generate (the latter three set via WithAPI) are required;
// CreateProvider returns an error instead of a Provider if any of them is
// missing, so a misconfigured provider never gets registered. WithModelLoader
// is optional.
func CreateProvider(opts ...Option) (IProvider, error) {
	d := &llmProvider{}
	for _, opt := range opts {
		opt(d)
	}

	if err := d.Validate(); err != nil {
		return nil, err
	}

	return d, nil
}
