package main

import (
	"fmt"
	"log"

	"parking-billing/config"
	"parking-billing/internal/billing"
	"parking-billing/internal/invoice"
	"parking-billing/internal/merchant"
	"parking-billing/internal/model"
	"parking-billing/internal/parking"
	"parking-billing/internal/payment"
	"parking-billing/internal/report"
	"parking-billing/middleware"
	"parking-billing/pkg/cache"
	"parking-billing/pkg/database"
	"parking-billing/pkg/mq"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := config.Load("config.yaml"); err != nil {
		log.Printf("Warning: load config failed: %v", err)
	}

	gin.SetMode(config.C.Server.Mode)

	if err := database.Init(config.C.Database); err != nil {
		log.Printf("Warning: init database failed: %v", err)
	} else {
		database.DB.AutoMigrate(
			&model.ParkingZone{},
			&model.ParkingSpot{},
			&model.VehicleEntry{},
			&model.ParkingScreen{},
			&billing.BillingRule{},
			&billing.BillingDetail{},
			&billing.Discount{},
			&billing.Coupon{},
			&payment.Payment{},
			&payment.SeasonCard{},
			&payment.AutoPayBinding{},
			&invoice.Invoice{},
			&merchant.Merchant{},
			&merchant.MerchantRule{},
			&merchant.ConsumptionRecord{},
			&merchant.MerchantBenefit{},
			&report.OccupancyStat{},
			&report.DailyRevenue{},
			&report.PeakHourStat{},
		)
	}

	if err := cache.Init(config.C.Redis); err != nil {
		log.Printf("Warning: init redis failed: %v", err)
	}

	if err := mq.Init(config.C.RabbitMQ); err != nil {
		log.Printf("Warning: init rabbitmq failed: %v", err)
	}
	defer mq.Close()

	r := gin.New()
	r.Use(middleware.Logger())
	r.Use(middleware.Recovery())
	r.Use(middleware.CORS())

	api := r.Group("/api/v1")
	{
		p := api.Group("/parking")
		{
			p.POST("/entry", parking.Entry)
			p.POST("/exit", parking.Exit)
			p.GET("/entry/:id", parking.GetEntry)
			p.GET("/entry/plate/:plate_number", parking.GetEntryByPlate)
			p.GET("/entry/qr/:qr_code", parking.GetEntryByQR)
			p.GET("/spots/available", parking.GetAvailableSpots)
			p.GET("/zones/status", parking.GetZoneStatus)
			p.POST("/zones", parking.CreateZone)
			p.POST("/spots", parking.CreateSpot)
			p.POST("/screens", parking.CreateScreen)
			p.GET("/screens", parking.ListScreens)
			p.PUT("/screens/:id", parking.UpdateScreen)
		}

		b := api.Group("/billing")
		{
			b.POST("/rules", billing.CreateRule)
			b.GET("/rules", billing.ListRules)
			b.POST("/calculate", billing.Calculate)
			b.POST("/coupons", billing.CreateCoupon)
			b.POST("/discounts", billing.CreateDiscount)
		}

		pm := api.Group("/payment")
		{
			pm.POST("/pay", payment.Pay)
			pm.GET("/season/:plate_number", payment.CheckSeasonCard)
			pm.POST("/season", payment.CreateSeasonCard)
			pm.POST("/autopay/bind", payment.BindAutoPay)
			pm.GET("/autopay/:plate_number", payment.CheckAutoDeduct)
			pm.GET("/entry/:entry_id", payment.GetPaymentByEntry)
		}

		inv := api.Group("/invoice")
		{
			inv.POST("/apply", invoice.ApplyInvoice)
			inv.GET("/qr/:invoice_no", invoice.GetInvoiceByQR)
			inv.POST("/red", invoice.RedInvoice)
			inv.POST("/void/:id", invoice.VoidInvoice)
			inv.GET("/list", invoice.ListInvoices)
		}

		mc := api.Group("/merchant")
		{
			mc.POST("", merchant.CreateMerchant)
			mc.GET("", merchant.ListMerchants)
			mc.POST("/rules", merchant.CreateRule)
			mc.POST("/consume", merchant.ReportConsumption)
			mc.POST("/benefit", merchant.ApplyBenefit)
			mc.GET("/benefit/:entry_id", merchant.GetBenefits)
		}

		rp := api.Group("/report")
		{
			rp.GET("/occupancy", report.ZoneOccupancy)
			rp.GET("/revenue/daily", report.DailyRevenueReport)
			rp.GET("/peak", report.PeakHourReport)
			rp.GET("/dashboard", report.Dashboard)
			rp.POST("/generate-daily", func(c *gin.Context) {
				report.GenerateDailyStats()
				c.JSON(200, gin.H{"status": "ok"})
			})
		}
	}

	addr := fmt.Sprintf(":%d", config.C.Server.Port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}
