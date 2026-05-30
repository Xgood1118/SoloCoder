package invoice

import (
	"time"

	"gorm.io/gorm"
)

type Invoice struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	PaymentID      uint           `gorm:"index;not null" json:"payment_id"`
	InvoiceNo      string         `gorm:"size:50;uniqueIndex;not null" json:"invoice_no"`
	Title          string         `gorm:"size:200;not null" json:"title"`
	TaxNo          string         `gorm:"size:50;not null" json:"tax_no"`
	AmountCents    int64          `gorm:"not null" json:"amount_cents"`
	Status         string         `gorm:"size:20;not null;default:'issued'" json:"status"`
	Email          string         `gorm:"size:100" json:"email"`
	EmailSent      bool           `gorm:"not null;default:false" json:"email_sent"`
	QRCodeURL      string         `gorm:"size:300" json:"qr_code_url"`
	RedInvoiceID   *uint          `json:"red_invoice_id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}
