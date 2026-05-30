package report

import (
	"net/http"
	"time"

	"parking-billing/pkg/database"
	"parking-billing/pkg/util"

	"github.com/gin-gonic/gin"
)

func ZoneOccupancy(c *gin.Context) {
	zoneID := c.Query("zone_id")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	query := database.DB.Order("recorded_at ASC")
	if zoneID != "" {
		query = query.Where("zone_id = ?", zoneID)
	}
	if startDate != "" {
		query = query.Where("recorded_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("recorded_at <= ?", endDate+" 23:59:59")
	}

	var stats []OccupancyStat
	if err := query.Find(&stats).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func DailyRevenueReport(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	query := database.DB.Order("date ASC")
	if startDate != "" {
		query = query.Where("date >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("date <= ?", endDate)
	}

	var revenues []DailyRevenue
	if err := query.Find(&revenues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type RevenueSummary struct {
		Date           string  `json:"date"`
		TotalPayments  int     `json:"total_payments"`
		TotalYuan      float64 `json:"total_yuan"`
		WechatYuan     float64 `json:"wechat_yuan"`
		AlipayYuan     float64 `json:"alipay_yuan"`
		CashYuan       float64 `json:"cash_yuan"`
		BankCardYuan   float64 `json:"bank_card_yuan"`
		AutoDeductYuan float64 `json:"auto_deduct_yuan"`
	}

	var result []RevenueSummary
	for _, r := range revenues {
		result = append(result, RevenueSummary{
			Date:           r.Date,
			TotalPayments:  r.TotalPayments,
			TotalYuan:      util.CentsToYuan(r.TotalCents),
			WechatYuan:     util.CentsToYuan(r.WechatCents),
			AlipayYuan:     util.CentsToYuan(r.AlipayCents),
			CashYuan:       util.CentsToYuan(r.CashCents),
			BankCardYuan:   util.CentsToYuan(r.BankCardCents),
			AutoDeductYuan: util.CentsToYuan(r.AutoDeductCents),
		})
	}
	c.JSON(http.StatusOK, result)
}

func PeakHourReport(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	var stats []PeakHourStat
	if err := database.DB.Where("date = ?", date).Order("hour ASC").Find(&stats).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	peakEntryHour := 0
	peakExitHour := 0
	maxEntry := 0
	maxExit := 0
	for _, s := range stats {
		if s.EntryCount > maxEntry {
			maxEntry = s.EntryCount
			peakEntryHour = s.Hour
		}
		if s.ExitCount > maxExit {
			maxExit = s.ExitCount
			peakExitHour = s.Hour
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"date":             date,
		"hourly_stats":     stats,
		"peak_entry_hour":  peakEntryHour,
		"peak_exit_hour":   peakExitHour,
	})
}

func Dashboard(c *gin.Context) {
	var totalEntries int64
	database.DB.Table("vehicle_entries").Where("status = ?", "parked").Count(&totalEntries)

	var totalSpots int64
	database.DB.Table("parking_spots").Count(&totalSpots)

	var availableSpots int64
	database.DB.Table("parking_spots").Where("status = ?", "available").Count(&availableSpots)

	today := time.Now().Format("2006-01-02")
	var todayRevenue DailyRevenue
	database.DB.Where("date = ?", today).First(&todayRevenue)

	c.JSON(http.StatusOK, gin.H{
		"parked_vehicles":    totalEntries,
		"total_spots":        totalSpots,
		"available_spots":    availableSpots,
		"occupancy_rate":     occupancyRate(totalEntries, totalSpots),
		"today_revenue_yuan": util.CentsToYuan(todayRevenue.TotalCents),
		"today_payments":     todayRevenue.TotalPayments,
	})
}

func GenerateDailyStats() {
	today := time.Now().Format("2006-01-02")

	type ZoneCount struct {
		ZoneID uint
		Total  int64
	}
	var zones []ZoneCount
	database.DB.Table("parking_spots").
		Select("zone_id, count(*) as total").
		Where("deleted_at IS NULL").
		Group("zone_id").
		Scan(&zones)

	for _, z := range zones {
		var occupied int64
		database.DB.Table("parking_spots").
			Where("zone_id = ? AND status = ?", z.ZoneID, "occupied").
			Count(&occupied)

		rate := float64(0)
		if z.Total > 0 {
			rate = float64(occupied) / float64(z.Total) * 100
		}

		stat := OccupancyStat{
			ZoneID:        z.ZoneID,
			TotalSpots:    int(z.Total),
			OccupiedSpots: int(occupied),
			OccupancyRate: rate,
			RecordedAt:    time.Now(),
		}
		database.DB.Create(&stat)
	}

	var revenue struct {
		Total    int64
		Wechat   int64
		Alipay   int64
		Cash     int64
		BankCard int64
		Auto     int64
		Count    int64
	}
	database.DB.Table("payments").
		Select("COALESCE(SUM(amount_cents),0) as total, "+
			"COALESCE(SUM(CASE WHEN method='wechat' THEN amount_cents ELSE 0 END),0) as wechat, "+
			"COALESCE(SUM(CASE WHEN method='alipay' THEN amount_cents ELSE 0 END),0) as alipay, "+
			"COALESCE(SUM(CASE WHEN method='cash' THEN amount_cents ELSE 0 END),0) as cash, "+
			"COALESCE(SUM(CASE WHEN method='bank_card' THEN amount_cents ELSE 0 END),0) as bank_card, "+
			"COALESCE(SUM(CASE WHEN method='auto_deduct' THEN amount_cents ELSE 0 END),0) as auto, "+
			"COUNT(*) as count").
		Where("DATE(paid_at) = ?", today).
		Scan(&revenue)

	dailyRev := DailyRevenue{
		Date:            today,
		TotalPayments:   int(revenue.Count),
		TotalCents:      revenue.Total,
		WechatCents:     revenue.Wechat,
		AlipayCents:     revenue.Alipay,
		CashCents:       revenue.Cash,
		BankCardCents:   revenue.BankCard,
		AutoDeductCents: revenue.Auto,
	}
	database.DB.Where("date = ?", today).Assign(dailyRev).FirstOrCreate(&DailyRevenue{})

	for hour := 0; hour < 24; hour++ {
		var entryCount, exitCount int64
		database.DB.Table("vehicle_entries").
			Where("DATE(entry_time) = ? AND HOUR(entry_time) = ?", today, hour).
			Count(&entryCount)
		database.DB.Table("vehicle_entries").
			Where("DATE(exit_time) = ? AND HOUR(exit_time) = ?", today, hour).
			Count(&exitCount)

		if entryCount > 0 || exitCount > 0 {
			stat := PeakHourStat{
				Date:       today,
				Hour:       hour,
				EntryCount: int(entryCount),
				ExitCount:  int(exitCount),
			}
			database.DB.Where("date = ? AND hour = ?", today, hour).Assign(stat).FirstOrCreate(&PeakHourStat{})
		}
	}
}

func occupancyRate(occupied, total int64) float64 {
	if total == 0 {
		return 0
	}
	return float64(occupied) / float64(total) * 100
}
