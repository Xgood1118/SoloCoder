package firmware

import (
	"strings"
	"time"

	"github.com/device-manager/internal/model"
	"github.com/device-manager/pkg/database"
	"github.com/google/uuid"
)

func generateFirmwareID() string {
	return "fw_" + strings.ReplaceAll(uuid.New().String(), "-", "")
}

func generateJobID() string {
	return "job_" + strings.ReplaceAll(uuid.New().String(), "-", "")
}

func generateRecordID() string {
	return "rec_" + strings.ReplaceAll(uuid.New().String(), "-", "")
}

func CreateFirmware(version, deviceType, name, description, fileURL, checksum, checksumType string, fileSize int64, minVersion, maxVersion string) (*model.Firmware, error) {
	firmware := &model.Firmware{
		FirmwareID:   generateFirmwareID(),
		Version:      version,
		DeviceType:   deviceType,
		Name:         name,
		Description:  description,
		FileSize:     fileSize,
		FileURL:      fileURL,
		Checksum:     checksum,
		ChecksumType: checksumType,
		Status:       model.FirmwareStatusDraft,
		MinVersion:   minVersion,
		MaxVersion:   maxVersion,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	if err := database.DB.Create(firmware).Error; err != nil {
		return nil, err
	}
	return firmware, nil
}

func GetFirmware(firmwareID string) (*model.Firmware, error) {
	var firmware model.Firmware
	err := database.DB.Where("firmware_id = ?", firmwareID).First(&firmware).Error
	return &firmware, err
}

func ListFirmware(deviceType string, status model.FirmwareStatus) ([]model.Firmware, error) {
	var firmwares []model.Firmware
	query := database.DB
	if deviceType != "" {
		query = query.Where("device_type = ?", deviceType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&firmwares).Error
	return firmwares, err
}

func UpdateFirmwareStatus(firmwareID string, status model.FirmwareStatus) error {
	return database.DB.Model(&model.Firmware{}).Where("firmware_id = ?", firmwareID).Updates(map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}).Error
}

func CheckUpgradeCompatibility(deviceType, currentVersion, targetVersion string) (bool, string, error) {
	var firmware model.Firmware
	err := database.DB.Where("device_type = ? AND version = ?", deviceType, targetVersion).First(&firmware).Error
	if err != nil {
		return false, "", err
	}

	if firmware.MinVersion != "" && currentVersion < firmware.MinVersion {
		return false, "Current version too old, please upgrade to " + firmware.MinVersion + " first", nil
	}
	if firmware.MaxVersion != "" && currentVersion > firmware.MaxVersion {
		return false, "Current version is newer than target version", nil
	}
	return true, "", nil
}

func CreateUpgradeJob(firmwareID, deviceType string, deviceIDs []string) (*model.FirmwareUpgradeJob, error) {
	deviceIDsStr := strings.Join(deviceIDs, ",")
	job := &model.FirmwareUpgradeJob{
		JobID:        generateJobID(),
		FirmwareID:   firmwareID,
		DeviceIDs:    deviceIDsStr,
		DeviceType:   deviceType,
		Status:       model.UpgradeStatusPending,
		TotalDevices: len(deviceIDs),
		SuccessCount: 0,
		FailedCount:  0,
		CreatedAt:    time.Now(),
	}
	if err := database.DB.Create(job).Error; err != nil {
		return nil, err
	}

	for _, deviceID := range deviceIDs {
		record := &model.DeviceUpgradeRecord{
			RecordID:   generateRecordID(),
			JobID:      job.JobID,
			DeviceID:   deviceID,
			FirmwareID: firmwareID,
			Status:     model.UpgradeStatusPending,
			Progress:   0,
			CreatedAt:  time.Now(),
		}
		database.DB.Create(record)
	}

	return job, nil
}

func GetUpgradeJob(jobID string) (*model.FirmwareUpgradeJob, error) {
	var job model.FirmwareUpgradeJob
	err := database.DB.Where("job_id = ?", jobID).First(&job).Error
	return &job, err
}

func UpdateUpgradeProgress(deviceID, jobID string, status model.UpgradeStatus, progress int, errorMsg string) error {
	updates := map[string]interface{}{
		"status": status,
	}

	if progress > 0 {
		updates["progress"] = progress
	}
	if errorMsg != "" {
		updates["error_message"] = errorMsg
	}

	now := time.Now()
	if status == model.UpgradeStatusDownloading {
		updates["started_at"] = &now
	} else if status == model.UpgradeStatusSuccess || status == model.UpgradeStatusFailed {
		updates["completed_at"] = &now
	}

	err := database.DB.Model(&model.DeviceUpgradeRecord{}).
		Where("device_id = ? AND job_id = ?", deviceID, jobID).
		Updates(updates).Error
	if err != nil {
		return err
	}

	return updateJobStatistics(jobID)
}

func updateJobStatistics(jobID string) error {
	var successCount, failedCount int64
	database.DB.Model(&model.DeviceUpgradeRecord{}).
		Where("job_id = ? AND status = ?", jobID, model.UpgradeStatusSuccess).
		Count(&successCount)
	database.DB.Model(&model.DeviceUpgradeRecord{}).
		Where("job_id = ? AND status = ?", jobID, model.UpgradeStatusFailed).
		Count(&failedCount)

	var totalDevices int64
	database.DB.Model(&model.DeviceUpgradeRecord{}).
		Where("job_id = ?", jobID).
		Count(&totalDevices)

	updates := map[string]interface{}{
		"success_count": int(successCount),
		"failed_count":  int(failedCount),
	}

	if successCount+failedCount == totalDevices {
		now := time.Now()
		updates["completed_at"] = &now
		if failedCount > 0 {
			updates["status"] = model.UpgradeStatusFailed
		} else {
			updates["status"] = model.UpgradeStatusSuccess
		}
	}

	return database.DB.Model(&model.FirmwareUpgradeJob{}).
		Where("job_id = ?", jobID).
		Updates(updates).Error
}

func GetDeviceUpgradeRecords(deviceID string, limit int) ([]model.DeviceUpgradeRecord, error) {
	var records []model.DeviceUpgradeRecord
	err := database.DB.Where("device_id = ?", deviceID).
		Order("created_at DESC").
		Limit(limit).
		Find(&records).Error
	return records, err
}
