package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/purchase-workflow/internal/model"
	"github.com/purchase-workflow/internal/repository"
	"gorm.io/gorm"
)

type WorkflowHandler struct {
	db *gorm.DB
}

func NewWorkflowHandler() *WorkflowHandler {
	return &WorkflowHandler{
		db: repository.GetDB(),
	}
}

func (h *WorkflowHandler) List(c *gin.Context) {
	var workflows []model.WorkflowDefinition
	if err := h.db.Where("is_active = ?", true).Find(&workflows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, workflows)
}

func (h *WorkflowHandler) GetDetail(c *gin.Context) {
	id := c.Param("id")
	var workflow model.WorkflowDefinition
	if err := h.db.Preload("Nodes").Preload("Nodes.Conditions").Where("id = ?", id).First(&workflow).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "工作流不存在"})
		return
	}
	c.JSON(http.StatusOK, workflow)
}

func (h *WorkflowHandler) Create(c *gin.Context) {
	var workflow model.WorkflowDefinition
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Create(&workflow).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workflow)
}

func (h *WorkflowHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var workflow model.WorkflowDefinition
	if err := h.db.Where("id = ?", id).First(&workflow).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "工作流不存在"})
		return
	}

	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Save(&workflow).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workflow)
}

func (h *WorkflowHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Model(&model.WorkflowDefinition{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}
