package llm

import (
	"time"

	"github.com/google/uuid"
)

// Role identifies who authored a Message in a conversation.
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

// Message is a single turn in a conversation. Sequence
// orders messages within a conversation; Final marks whether this is the
// last chunk of a (possibly streamed) response and is not persisted.
type Message struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Role      Role      `json:"role" gorm:"type:varchar(50);not null"`
	Sequence  int       `json:"sequence" gorm:"type:integer;not null"`
	Content   string    `json:"content" gorm:"type:text"`
	Timestamp time.Time `json:"timestamp" gorm:"type:timestamp;not null;default:now()"`
}

// MessageOption configures a Message built via NewMessage.
type MessageOption func(*Message)

// WithID overrides the message's auto-generated ID.
func WithID(id string) MessageOption {
	return func(message *Message) {
		message.ID = id
	}
}

// WithSequence sets the message's position within its conversation.
func WithSequence(sequence int) MessageOption {
	return func(message *Message) {
		message.Sequence = sequence
	}
}

// WithTimestamp overrides the message's auto-generated Timestamp.
func WithTimestamp(timestamp time.Time) MessageOption {
	return func(message *Message) {
		message.Timestamp = timestamp
	}
}

// NewMessage builds a Message with a generated ID and current Timestamp,
// customized by the given MessageOptions.
func NewMessage(role Role, content string, options ...MessageOption) Message {
	message := Message{
		ID:        uuid.NewString(),
		Role:      role,
		Sequence:  0,
		Content:   content,
		Timestamp: time.Now(),
	}
	for _, option := range options {
		option(&message)
	}
	return message
}
