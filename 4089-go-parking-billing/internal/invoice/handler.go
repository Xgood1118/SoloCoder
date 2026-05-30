package invoice

import (
	"fmt"
	"net/http"
	"time"

	"parking-billing/config"
	"parking-billing/pkg/database"
	"parking-billing/pkg/util"

	"github.com/gin-gonic/gin"
	"gopkg.in/gomail.v2"
)

type InvoiceRequest struct {
	PaymentID uint   `json:"payment_id" binding:"required"`
	Title     string `json:"title" binding:"required"`
	TaxNo     string `json:"tax_no" binding:"required"`
	Email     string `json:"email"`
}

type RedInvoiceRequest struct {
	InvoiceID uint   `json:"invoice_id" binding:"required"`
	Reason    string `json:"reason"`
}

var invoiceCounter int64

func generateInvoiceNo() string {
	invoiceCounter++
	now := time.Now()
	return fmt.Sprintf("INV%d%04d", now.Format("20060102"), invoiceCounter)
}

func ApplyInvoice(c *gin.Context) {
	var req InvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var payment struct {
		ID          uint  `json:"id"`
		AmountCents int64 `json:"amount_cents"`
		Status      string `json:"status"`
	}
	if err := database.DB.Table("payments").Where("id = ? AND status = ?", req.PaymentID, "paid").Take(&payment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "paid payment not found"})
		return
	}

	var existing Invoice
	if err := database.DB.Where("payment_id = ? AND status = ?", req.PaymentID, "issued").First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "invoice already issued for this payment"})
		return
	}

	invoiceNo := generateInvoiceNo()
	qrURL := fmt.Sprintf("https://parking.example.com/invoice/qr/%s", invoiceNo)

	invoice := Invoice{
		PaymentID:   req.PaymentID,
		InvoiceNo:   invoiceNo,
		Title:       req.Title,
		TaxNo:       req.TaxNo,
		AmountCents: payment.AmountCents,
		Status:      "issued",
		Email:       req.Email,
		QRCodeURL:   qrURL,
	}

	if err := database.DB.Create(&invoice).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.Email != "" {
		go sendInvoiceEmail(invoice)
	}

	c.JSON(http.StatusOK, gin.H{
		"invoice_id":   invoice.ID,
		"invoice_no":   invoice.InvoiceNo,
		"title":        invoice.Title,
		"tax_no":       invoice.TaxNo,
		"amount_yuan":  util.CentsToYuan(invoice.AmountCents),
		"amount_cents": invoice.AmountCents,
		"status":       invoice.Status,
		"qr_code_url":  invoice.QRCodeURL,
	})
}

func GetInvoiceByQR(c *gin.Context) {
	invoiceNo := c.Param("invoice_no")
	var invoice Invoice
	if err := database.DB.Where("invoice_no = ?", invoiceNo).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invoice not found"})
		return
	}
	c.JSON(http.StatusOK, invoice)
}

func RedInvoice(c *gin.Context) {
	var req RedInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var original Invoice
	if err := database.DB.Where("id = ? AND status = ?", req.InvoiceID, "issued").First(&original).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "original invoice not found or already voided"})
		return
	}

	redNo := generateInvoiceNo()
	redInvoice := Invoice{
		PaymentID:    original.PaymentID,
		InvoiceNo:    redNo,
		Title:        original.Title,
		TaxNo:        original.TaxNo,
		AmountCents:  -original.AmountCents,
		Status:       "red",
		Email:        original.Email,
	}
	database.DB.Create(&redInvoice)

	original.Status = "voided"
	original.RedInvoiceID = &redInvoice.ID
	database.DB.Save(&original)

	c.JSON(http.StatusOK, gin.H{
		"original_status": "voided",
		"red_invoice_id":  redInvoice.ID,
		"red_invoice_no":  redInvoice.InvoiceNo,
		"red_amount_cents": redInvoice.AmountCents,
	})
}

func VoidInvoice(c *gin.Context) {
	invoiceID := c.Param("id")
	var invoice Invoice
	if err := database.DB.Where("id = ? AND status = ?", invoiceID, "issued").First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invoice not found or not issued"})
		return
	}
	invoice.Status = "voided"
	database.DB.Save(&invoice)
	c.JSON(http.StatusOK, gin.H{"invoice_id": invoice.ID, "status": "voided"})
}

func sendInvoiceEmail(invoice Invoice) {
	cfg := config.C.Invoice
	m := gomail.NewMessage()
	m.SetHeader("From", cfg.SMTPUser)
	m.SetHeader("To", invoice.Email)
	m.SetHeader("Subject", fmt.Sprintf("停车发票 %s", invoice.InvoiceNo))
	m.SetBody("text/html", fmt.Sprintf(
		"<h2>电子发票</h2><p>发票号: %s</p><p>抬头: %s</p><p>税号: %s</p><p>金额: %.2f 元</p>",
		invoice.InvoiceNo, invoice.Title, invoice.TaxNo, util.CentsToYuan(invoice.AmountCents),
	))

	d := gomail.NewDialer(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword)
	if err := d.DialAndSend(m); err == nil {
		database.DB.Model(&invoice).Update("email_sent", true)
	}
}

func ListInvoices(c *gin.Context) {
	var invoices []Invoice
	paymentID := c.Query("payment_id")
	query := database.DB.Order("created_at DESC")
	if paymentID != "" {
		query = query.Where("payment_id = ?", paymentID)
	}
	if err := query.Find(&invoices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, invoices)
}
