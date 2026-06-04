package api

import (
	"approval-flow/internal/engine"
	"approval-flow/internal/models"
	"approval-flow/internal/notification"
	"encoding/json"
	"net/http"
	"strings"
)

type Handler struct {
	engine        *engine.Engine
	notifService  *notification.NotificationService
}

func NewHandler(e *engine.Engine, ns *notification.NotificationService) *Handler {
	return &Handler{
		engine:       e,
		notifService: ns,
	}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/flows", h.handleFlows)
	mux.HandleFunc("/api/flows/", h.handleFlow)
	mux.HandleFunc("/api/instances", h.handleInstances)
	mux.HandleFunc("/api/instances/", h.handleInstance)
	mux.HandleFunc("/api/notifications/", h.handleNotifications)
}

func (h *Handler) handleFlows(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listFlows(w, r)
	case http.MethodPost:
		h.createFlow(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleFlow(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/flows/")
	if id == "" {
		http.Error(w, "flow id required", http.StatusBadRequest)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	h.getFlow(w, r, id)
}

func (h *Handler) handleInstances(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.startInstance(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleInstance(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/instances/")
	parts := strings.Split(path, "/")
	id := parts[0]

	if id == "" {
		http.Error(w, "instance id required", http.StatusBadRequest)
		return
	}

	if len(parts) > 1 {
		h.handleInstanceAction(w, r, id, parts[1])
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getInstance(w, r, id)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleInstanceAction(w http.ResponseWriter, r *http.Request, id, action string) {
	switch action {
	case "approve":
		h.approveInstance(w, r, id)
	case "reject":
		h.rejectInstance(w, r, id)
	case "transfer":
		h.transferInstance(w, r, id)
	case "suspend":
		h.suspendInstance(w, r, id)
	case "activate":
		h.activateInstance(w, r, id)
	case "history":
		h.getInstanceHistory(w, r, id)
	default:
		http.Error(w, "unknown action", http.StatusBadRequest)
	}
}

func (h *Handler) listFlows(w http.ResponseWriter, r *http.Request) {
	flows, err := h.engine.ListFlowDefinitions(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(flows)
}

func (h *Handler) createFlow(w http.ResponseWriter, r *http.Request) {
	var fd models.FlowDefinition
	if err := json.NewDecoder(r.Body).Decode(&fd); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.engine.CreateFlowDefinition(r.Context(), &fd); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(fd)
}

func (h *Handler) getFlow(w http.ResponseWriter, r *http.Request, id string) {
	fd, err := h.engine.GetFlowDefinition(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if fd == nil {
		http.Error(w, "flow not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(fd)
}

type StartInstanceRequest struct {
	FlowDefID string                 `json:"flow_def_id"`
	Title     string                 `json:"title"`
	Initiator string                 `json:"initiator"`
	Variables map[string]interface{} `json:"variables"`
	Data      map[string]interface{} `json:"data"`
}

func (h *Handler) startInstance(w http.ResponseWriter, r *http.Request) {
	var req StartInstanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	instance, err := h.engine.StartInstance(r.Context(), req.FlowDefID, req.Title, req.Initiator, req.Variables, req.Data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(instance)
}

func (h *Handler) getInstance(w http.ResponseWriter, r *http.Request, id string) {
	instance, err := h.engine.GetInstance(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if instance == nil {
		http.Error(w, "instance not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(instance)
}

type ApprovalRequest struct {
	Approver string `json:"approver"`
	Comment  string `json:"comment"`
	TargetNodeID string `json:"target_node_id,omitempty"`
	ToApprover string `json:"to_approver,omitempty"`
}

func (h *Handler) approveInstance(w http.ResponseWriter, r *http.Request, id string) {
	var req ApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.engine.Approve(r.Context(), id, req.Approver, req.Comment); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "approved"})
}

func (h *Handler) rejectInstance(w http.ResponseWriter, r *http.Request, id string) {
	var req ApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.engine.Reject(r.Context(), id, req.Approver, req.Comment, req.TargetNodeID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "rejected"})
}

func (h *Handler) transferInstance(w http.ResponseWriter, r *http.Request, id string) {
	var req ApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.engine.Transfer(r.Context(), id, req.Approver, req.ToApprover, req.Comment); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "transferred"})
}

func (h *Handler) suspendInstance(w http.ResponseWriter, r *http.Request, id string) {
	if err := h.engine.Suspend(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "suspended"})
}

func (h *Handler) activateInstance(w http.ResponseWriter, r *http.Request, id string) {
	if err := h.engine.Activate(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "activated"})
}

func (h *Handler) getInstanceHistory(w http.ResponseWriter, r *http.Request, id string) {
	comments, err := h.engine.GetApprovalHistory(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(comments)
}

func (h *Handler) handleNotifications(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/notifications/")
	parts := strings.Split(path, "/")
	userID := parts[0]

	if userID == "" {
		http.Error(w, "user id required", http.StatusBadRequest)
		return
	}

	if len(parts) > 1 {
		switch parts[1] {
		case "preference":
			h.handleNotificationPreference(w, r, userID)
			return
		case "email":
			h.handleUserEmail(w, r, userID)
			return
		}
	}

	switch r.Method {
	case http.MethodGet:
		messages := h.notifService.GetUnreadMessages(userID)
		json.NewEncoder(w).Encode(messages)
	case http.MethodPost:
		var req struct {
			MessageID string `json:"message_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		h.notifService.MarkAsRead(userID, req.MessageID)
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleNotificationPreference(w http.ResponseWriter, r *http.Request, userID string) {
	switch r.Method {
	case http.MethodGet:
		pref := h.notifService.GetUserPreference(userID)
		json.NewEncoder(w).Encode(map[string]string{"channel": string(pref)})
	case http.MethodPut, http.MethodPost:
		var req struct {
			Channel string `json:"channel"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		h.notifService.SetUserPreference(userID, models.NotificationChannel(req.Channel))
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "channel": req.Channel})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleUserEmail(w http.ResponseWriter, r *http.Request, userID string) {
	switch r.Method {
	case http.MethodGet:
		email := h.notifService.GetUserEmail(userID)
		json.NewEncoder(w).Encode(map[string]string{"email": email})
	case http.MethodPut, http.MethodPost:
		var req struct {
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		h.notifService.SetUserEmail(userID, req.Email)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "email": req.Email})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) serveDesigner(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(designerHTML))
}

func StartServer(addr string, handler *Handler) error {
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	mux.HandleFunc("/", handler.serveDesigner)
	mux.HandleFunc("/designer", handler.serveDesigner)
	return http.ListenAndServe(addr, CORS(mux))
}

const designerHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>流程设计器</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 20px; }
        .header-actions { display: flex; gap: 10px; }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
        .btn-primary { background: #fff; color: #667eea; }
        .btn-success { background: #10b981; color: white; }
        .btn-danger { background: #ef4444; color: white; }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .container { display: flex; height: calc(100vh - 60px); }
        .sidebar { width: 260px; background: white; border-right: 1px solid #e5e7eb; padding: 20px; overflow-y: auto; }
        .sidebar h3 { margin-bottom: 15px; color: #374151; font-size: 14px; }
        .node-palette { display: flex; flex-direction: column; gap: 10px; }
        .palette-item { padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; cursor: grab; background: #f9fafb; display: flex; align-items: center; gap: 10px; transition: all 0.2s; }
        .palette-item:hover { border-color: #667eea; background: #eef2ff; }
        .palette-item .icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; }
        .icon-start { background: #10b981; color: white; }
        .icon-approval { background: #3b82f6; color: white; }
        .icon-condition { background: #f59e0b; color: white; }
        .icon-end { background: #ef4444; color: white; }
        .canvas-container { flex: 1; position: relative; overflow: hidden; }
        #canvas { width: 100%; height: 100%; position: relative; background-image: radial-gradient(circle, #d1d5db 1px, transparent 1px); background-size: 20px 20px; }
        .flow-node { position: absolute; min-width: 140px; padding: 15px; border-radius: 10px; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: move; border: 2px solid transparent; transition: all 0.2s; user-select: none; }
        .flow-node:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
        .flow-node.selected { border-color: #667eea; }
        .flow-node.start { border-left: 4px solid #10b981; }
        .flow-node.approval { border-left: 4px solid #3b82f6; }
        .flow-node.condition { border-left: 4px solid #f59e0b; }
        .flow-node.end { border-left: 4px solid #ef4444; }
        .node-title { font-weight: 600; color: #1f2937; margin-bottom: 5px; }
        .node-type { font-size: 12px; color: #6b7280; }
        .node-approvers { font-size: 11px; color: #10b981; margin-top: 8px; }
        .delete-btn { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; border-radius: 50%; background: #ef4444; color: white; border: none; cursor: pointer; display: none; font-size: 12px; }
        .flow-node:hover .delete-btn { display: block; }
        .properties { width: 300px; background: white; border-left: 1px solid #e5e7eb; padding: 20px; overflow-y: auto; }
        .properties h3 { margin-bottom: 20px; color: #374151; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; }
        .form-group { margin-bottom: 18px; }
        .form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #4b5563; font-weight: 500; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
        .form-group input:focus, .form-group select:focus { outline: none; border-color: #667eea; }
        .condition-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .condition-row input, .condition-row select { flex: 1; padding: 8px; }
        .add-condition { width: 100%; padding: 8px; border: 2px dashed #d1d5db; background: transparent; border-radius: 6px; cursor: pointer; color: #6b7280; }
        .add-condition:hover { border-color: #667eea; color: #667eea; }
        .remove-btn { padding: 8px 12px; background: #fee2e2; color: #ef4444; border: none; border-radius: 4px; cursor: pointer; }
        .connections { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
        .empty-state { text-align: center; padding: 60px 20px; color: #9ca3af; }
        .empty-state svg { width: 80px; height: 80px; margin-bottom: 20px; opacity: 0.5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔄 审批流程设计器</h1>
        <div class="header-actions">
            <button class="btn btn-primary" onclick="loadFlowList()">📋 流程列表</button>
            <button class="btn btn-primary" onclick="clearCanvas()">🗑️ 清空</button>
            <button class="btn btn-success" onclick="saveFlow()">💾 保存流程</button>
        </div>
    </div>
    <div class="container">
        <div class="sidebar">
            <h3>节点组件</h3>
            <div class="node-palette">
                <div class="palette-item" draggable="true" data-type="start">
                    <div class="icon icon-start">S</div>
                    <span>开始节点</span>
                </div>
                <div class="palette-item" draggable="true" data-type="approval">
                    <div class="icon icon-approval">A</div>
                    <span>审批节点</span>
                </div>
                <div class="palette-item" draggable="true" data-type="condition">
                    <div class="icon icon-condition">C</div>
                    <span>条件节点</span>
                </div>
                <div class="palette-item" draggable="true" data-type="end">
                    <div class="icon icon-end">E</div>
                    <span>结束节点</span>
                </div>
            </div>
            <h3 style="margin-top: 30px;">操作提示</h3>
            <div style="font-size: 12px; color: #6b7280; line-height: 1.8;">
                <p>• 拖拽组件到画布创建节点</p>
                <p>• 点击节点查看/编辑属性</p>
                <p>• 从节点输出端拖拽连线</p>
                <p>• 悬停节点右上角可删除</p>
            </div>
        </div>
        <div class="canvas-container">
            <div id="canvas"></div>
            <svg class="connections" id="connections"></svg>
        </div>
        <div class="properties">
            <h3>节点属性</h3>
            <div id="properties-content">
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                        <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                    <p>选择一个节点编辑属性</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        let nodes = [];
        let connections = [];
        let selectedNode = null;
        let nodeIdCounter = 1;
        let draggingNode = null;
        let dragOffset = { x: 0, y: 0 };
        let isConnecting = false;
        let connectionStart = null;
        let tempLine = null;

        const canvas = document.getElementById('canvas');
        const connectionsEl = document.getElementById('connections');

        function getNodeActualWidth(nodeId) {
            const el = document.getElementById('node-' + nodeId);
            return el ? el.offsetWidth : 140;
        }
        function getNodeActualHeight(nodeId) {
            const el = document.getElementById('node-' + nodeId);
            return el ? el.offsetHeight : 60;
        }

        document.querySelectorAll('.palette-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('nodeType', item.dataset.type);
            });
        });

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const nodeType = e.dataTransfer.getData('nodeType');
            if (nodeType) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left - 70;
                const y = e.clientY - rect.top - 30;
                createNode(nodeType, x, y);
            }
        });

        function createNode(type, x, y, existingId) {
            var id = existingId || null;
            if (!id) {
                id = 'node_' + nodeIdCounter++;
            } else {
                var num = parseInt(id.replace(/[^0-9]/g, ''));
                if (!isNaN(num) && num >= nodeIdCounter) nodeIdCounter = num + 1;
            }
            const node = {
                id: id,
                type: type,
                name: getDefaultName(type),
                x: x,
                y: y,
                approvers: [],
                conditions: [],
                timeoutConfig: null,
                nextNodes: []
            };
            nodes.push(node);
            renderNode(node);
            selectNode(id);
            return node;
        }

        function getDefaultName(type) {
            const names = { start: '开始', approval: '审批节点', condition: '条件判断', end: '结束' };
            return names[type] || '节点';
        }

        function renderNode(node) {
            const el = document.createElement('div');
            el.className = 'flow-node ' + node.type;
            el.id = 'node-' + node.id;
            el.style.left = node.x + 'px';
            el.style.top = node.y + 'px';
            var approversHtml = '';
            if (node.approvers && node.approvers.length) {
                approversHtml = '<div class="node-approvers">审批人: ' + node.approvers.join(', ') + '</div>';
            }
            el.innerHTML = '<button class="delete-btn" onclick="deleteNode(\'' + node.id + '\')">×</button>' +
                '<div class="node-title">' + node.name + '</div>' +
                '<div class="node-type">' + getTypeName(node.type) + '</div>' +
                approversHtml;
            
            el.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('delete-btn')) return;
                selectNode(node.id);
                draggingNode = node;
                const rect = el.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
            });

            el.addEventListener('dblclick', (e) => {
                if (node.type !== 'end') {
                    startConnection(node, e);
                }
            });

            canvas.appendChild(el);
        }

        function getTypeName(type) {
            const names = { start: '开始节点', approval: '审批节点', condition: '条件分支', end: '结束节点' };
            return names[type] || type;
        }

        function selectNode(id) {
            document.querySelectorAll('.flow-node').forEach(el => el.classList.remove('selected'));
            const el = document.getElementById('node-' + id);
            if (el) el.classList.add('selected');
            selectedNode = nodes.find(n => n.id === id);
            renderProperties();
        }

        function deleteNode(id) {
            nodes.forEach(n => {
                n.nextNodes = (n.nextNodes || []).filter(nid => nid !== id);
            });
            nodes = nodes.filter(n => n.id !== id);
            connections = connections.filter(c => c.from !== id && c.to !== id);
            const el = document.getElementById('node-' + id);
            if (el) el.remove();
            renderConnections();
            selectedNode = null;
            renderProperties();
        }

        function renderProperties() {
            const container = document.getElementById('properties-content');
            if (!selectedNode) {
                container.innerHTML = '<div class="empty-state"><p>选择一个节点编辑属性</p></div>';
                return;
            }

            let html = '<div class="form-group"><label>节点名称</label><input type="text" id="prop-name" value="' + selectedNode.name + '" onchange="updateProperty(\'name\', this.value)"></div>';
            html += '<div class="form-group"><label>节点ID</label><input type="text" value="' + selectedNode.id + '" readonly style="background:#f3f4f6"></div>';
            html += '<div class="form-group"><label>节点类型</label><input type="text" value="' + getTypeName(selectedNode.type) + '" readonly style="background:#f3f4f6"></div>';

            if (selectedNode.type === 'approval') {
                html += '<div class="form-group"><label>审批人 (逗号分隔)</label><input type="text" id="prop-approvers" value="' + (selectedNode.approvers || []).join(', ') + '" onchange="updateApprovers(this.value)"></div>';
                html += '<div class="form-group"><label>超时时间(小时)</label><input type="number" id="prop-timeout" value="' + ((selectedNode.timeoutConfig && selectedNode.timeoutConfig.duration) ? selectedNode.timeoutConfig.duration / 3600000 : '') + '" placeholder="留空不启用" onchange="updateTimeout(this.value)"></div>';
                if (selectedNode.timeoutConfig) {
                    html += '<div class="form-group"><label>超时动作</label><select id="prop-timeout-action" onchange="updateTimeoutAction(this.value)"><option value="reminder"' + (selectedNode.timeoutConfig.action === 'reminder' ? ' selected' : '') + '>发送提醒</option><option value="auto_approve"' + (selectedNode.timeoutConfig.action === 'auto_approve' ? ' selected' : '') + '>自动通过</option><option value="auto_reject"' + (selectedNode.timeoutConfig.action === 'auto_reject' ? ' selected' : '') + '>自动驳回</option></select></div>';
                }
            }

            if (selectedNode.type === 'approval' || selectedNode.type === 'condition') {
                html += '<div class="form-group"><label>流转条件</label><div id="conditions-list">';
                (selectedNode.conditions || []).forEach((cond, idx) => {
                    html += '<div class="condition-row"><select onchange="updateConditionType(' + idx + ', this.value)"><option value="amount"' + (cond.type === 'amount' ? ' selected' : '') + '>金额条件</option><option value="variable"' + (cond.type === 'variable' ? ' selected' : '') + '>变量条件</option><option value="time"' + (cond.type === 'time' ? ' selected' : '') + '>时间条件</option><option value="expression"' + (cond.type === 'expression' ? ' selected' : '') + '>表达式</option></select>';
                    if (cond.type === 'expression') {
                        html += '<input type="text" placeholder="表达式" value="' + (cond.expression || '') + '" onchange="updateConditionExpression(' + idx + ', this.value)">';
                    } else {
                        html += '<input type="text" placeholder="字段名" value="' + (cond.field || '') + '" style="flex:0.8" onchange="updateConditionField(' + idx + ', this.value)"><select onchange="updateConditionOp(' + idx + ', this.value)"><option value="gt"' + (cond.operator === 'gt' ? ' selected' : '') + '>></option><option value="gte"' + (cond.operator === 'gte' ? ' selected' : '') + '>>=</option><option value="lt"' + (cond.operator === 'lt' ? ' selected' : '') + '><</option><option value="lte"' + (cond.operator === 'lte' ? ' selected' : '') + '><=</option><option value="eq"' + (cond.operator === 'eq' ? ' selected' : '') + '>=</option><option value="ne"' + (cond.operator === 'ne' ? ' selected' : '') + '>!=</option></select><input type="text" placeholder="值" value="' + (cond.value || '') + '" style="flex:0.7" onchange="updateConditionValue(' + idx + ', this.value)">';
                    }
                    html += '<button class="remove-btn" onclick="removeCondition(' + idx + ')">×</button></div>';
                });
                html += '</div><button class="add-condition" onclick="addCondition()">+ 添加条件</button></div>';
            }

            html += '<div class="form-group"><label>后续节点</label><div id="next-nodes-list">';
            (selectedNode.nextNodes || []).forEach((nextId, idx) => {
                const nextNode = nodes.find(n => n.id === nextId);
                html += '<div class="condition-row"><span>' + (nextNode ? nextNode.name : nextId) + '</span><button class="remove-btn" onclick="removeNextNode(' + idx + ')">移除</button></div>';
            });
            html += '</div><select id="add-next-node" style="width:auto;margin-top:8px" onchange="addNextNode(this.value)"><option value="">添加后续节点</option>';
            nodes.forEach(n => {
                if (n.id !== selectedNode.id && !(selectedNode.nextNodes || []).includes(n.id)) {
                    html += '<option value="' + n.id + '">' + n.name + '</option>';
                }
            });
            html += '</select></div>';

            container.innerHTML = html;
        }

        function updateProperty(prop, value) {
            if (selectedNode) {
                selectedNode[prop] = value;
                updateNodeDisplay(selectedNode);
            }
        }

        function updateApprovers(value) {
            if (selectedNode) {
                selectedNode.approvers = value.split(',').map(s => s.trim()).filter(s => s);
                updateNodeDisplay(selectedNode);
            }
        }

        function updateTimeout(value) {
            if (selectedNode) {
                const hours = parseFloat(value);
                if (hours > 0) {
                    selectedNode.timeoutConfig = { duration: hours * 3600000, action: (selectedNode.timeoutConfig && selectedNode.timeoutConfig.action) ? selectedNode.timeoutConfig.action : 'reminder' };
                } else {
                    selectedNode.timeoutConfig = null;
                }
                renderProperties();
            }
        }

        function updateTimeoutAction(value) {
            if (selectedNode && selectedNode.timeoutConfig) {
                selectedNode.timeoutConfig.action = value;
            }
        }

        function addCondition() {
            if (selectedNode) {
                if (!selectedNode.conditions) selectedNode.conditions = [];
                selectedNode.conditions.push({ type: 'amount', field: '', operator: 'gt', value: '' });
                renderProperties();
            }
        }

        function removeCondition(idx) {
            if (selectedNode && selectedNode.conditions) {
                selectedNode.conditions.splice(idx, 1);
                renderProperties();
            }
        }

        function updateConditionType(idx, value) {
            if (selectedNode && selectedNode.conditions) {
                selectedNode.conditions[idx].type = value;
                selectedNode.conditions[idx].expression = '';
                renderProperties();
            }
        }

        function updateConditionField(idx, value) {
            if (selectedNode && selectedNode.conditions) {
                selectedNode.conditions[idx].field = value;
            }
        }

        function updateConditionOp(idx, value) {
            if (selectedNode && selectedNode.conditions) {
                selectedNode.conditions[idx].operator = value;
            }
        }

        function updateConditionValue(idx, value) {
            if (selectedNode && selectedNode.conditions) {
                selectedNode.conditions[idx].value = isNaN(Number(value)) ? value : Number(value);
            }
        }

        function updateConditionExpression(idx, value) {
            if (selectedNode && selectedNode.conditions) {
                selectedNode.conditions[idx].expression = value;
            }
        }

        function addNextNode(nodeId) {
            if (selectedNode && nodeId) {
                if (!selectedNode.nextNodes) selectedNode.nextNodes = [];
                selectedNode.nextNodes.push(nodeId);
                syncConnectionsFromNodes();
                renderConnections();
                renderProperties();
                document.getElementById('add-next-node').value = '';
            }
        }

        function removeNextNode(idx) {
            if (selectedNode && selectedNode.nextNodes) {
                selectedNode.nextNodes.splice(idx, 1);
                syncConnectionsFromNodes();
                renderConnections();
                renderProperties();
            }
        }

        function syncConnectionsFromNodes() {
            connections = [];
            nodes.forEach(n => {
                (n.nextNodes || []).forEach(targetId => {
                    if (!connections.find(c => c.from === n.id && c.to === targetId)) {
                        connections.push({ from: n.id, to: targetId });
                    }
                });
            });
        }

        function updateNodeDisplay(node) {
            const el = document.getElementById('node-' + node.id);
            if (el) {
                el.querySelector('.node-title').textContent = node.name;
                const approversEl = el.querySelector('.node-approvers');
                if (node.approvers && node.approvers.length) {
                    if (approversEl) {
                        approversEl.textContent = '审批人: ' + node.approvers.join(', ');
                    } else {
                        const div = document.createElement('div');
                        div.className = 'node-approvers';
                        div.textContent = '审批人: ' + node.approvers.join(', ');
                        el.appendChild(div);
                    }
                } else if (approversEl) {
                    approversEl.remove();
                }
            }
        }

        function startConnection(node, e) {
            isConnecting = true;
            connectionStart = node;
            tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempLine.setAttribute('stroke', '#667eea');
            tempLine.setAttribute('stroke-width', '2');
            tempLine.setAttribute('fill', 'none');
            tempLine.setAttribute('stroke-dasharray', '5,5');
            connectionsEl.appendChild(tempLine);
        }

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            if (draggingNode) {
                draggingNode.x = e.clientX - rect.left - dragOffset.x;
                draggingNode.y = e.clientY - rect.top - dragOffset.y;
                const el = document.getElementById('node-' + draggingNode.id);
                el.style.left = draggingNode.x + 'px';
                el.style.top = draggingNode.y + 'px';
                renderConnections();
            }
            if (isConnecting && tempLine && connectionStart) {
                var w = getNodeActualWidth(connectionStart.id);
                var h = getNodeActualHeight(connectionStart.id);
                var startX = connectionStart.x + w;
                var startY = connectionStart.y + h / 2;
                var endX = e.clientX - rect.left;
                var endY = e.clientY - rect.top;
                var midX = (startX + endX) / 2;
                tempLine.setAttribute('d', 'M ' + startX + ' ' + startY + ' C ' + midX + ' ' + startY + ', ' + midX + ' ' + endY + ', ' + endX + ' ' + endY);
            }
        });

        document.addEventListener('mouseup', (e) => {
            draggingNode = null;
            if (isConnecting) {
                var target = e.target.closest('.flow-node');
                if (target && connectionStart) {
                    var targetId = target.id.replace('node-', '');
                    if (targetId !== connectionStart.id) {
                        if (!connectionStart.nextNodes) connectionStart.nextNodes = [];
                        if (!connectionStart.nextNodes.includes(targetId)) {
                            connectionStart.nextNodes.push(targetId);
                            syncConnectionsFromNodes();
                            renderConnections();
                            if (selectedNode && selectedNode.id === connectionStart.id) {
                                renderProperties();
                            }
                        }
                    }
                }
                if (tempLine) tempLine.remove();
                isConnecting = false;
                connectionStart = null;
                tempLine = null;
            }
        });

        function renderConnections() {
            connectionsEl.querySelectorAll('path:not([stroke-dasharray])').forEach(p => p.remove());
            connectionsEl.querySelectorAll('circle').forEach(c => c.remove());
            connections.forEach(conn => {
                const fromNode = nodes.find(n => n.id === conn.from);
                const toNode = nodes.find(n => n.id === conn.to);
                if (fromNode && toNode) {
                    var fw = getNodeActualWidth(fromNode.id);
                    var fh = getNodeActualHeight(fromNode.id);
                    var tw = getNodeActualWidth(toNode.id);
                    var th = getNodeActualHeight(toNode.id);
                    var startX = fromNode.x + fw;
                    var startY = fromNode.y + fh / 2;
                    var endX = toNode.x;
                    var endY = toNode.y + th / 2;
                    var midX = (startX + endX) / 2;
                    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', 'M ' + startX + ' ' + startY + ' C ' + midX + ' ' + startY + ', ' + midX + ' ' + endY + ', ' + endX + ' ' + endY);
                    path.setAttribute('stroke', '#94a3b8');
                    path.setAttribute('stroke-width', '2');
                    path.setAttribute('fill', 'none');
                    connectionsEl.appendChild(path);
                    var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    arrow.setAttribute('cx', endX);
                    arrow.setAttribute('cy', endY);
                    arrow.setAttribute('r', '4');
                    arrow.setAttribute('fill', '#94a3b8');
                    connectionsEl.appendChild(arrow);
                }
            });
        }

        function clearCanvas() {
            if (confirm('确定要清空画布吗？')) {
                nodes = [];
                connections = [];
                selectedNode = null;
                nodeIdCounter = 1;
                canvas.innerHTML = '';
                connectionsEl.innerHTML = '';
                renderProperties();
            }
        }

        function saveFlow() {
            var startNodes = nodes.filter(n => n.type === 'start');
            if (startNodes.length !== 1) {
                alert('流程必须包含且仅包含一个开始节点！');
                return;
            }
            var endNodes = nodes.filter(n => n.type === 'end');
            if (endNodes.length < 1) {
                alert('流程至少需要一个结束节点！');
                return;
            }
            
            var flowData = {
                name: prompt('请输入流程名称：', '新流程'),
                description: prompt('请输入流程描述：', ''),
                version: 1,
                createdBy: 'admin',
                startNodeID: startNodes[0].id,
                nodes: nodes.map(function(n) {
                    return {
                        id: n.id,
                        name: n.name,
                        type: n.type,
                        approvers: n.approvers || [],
                        conditions: n.conditions || [],
                        timeout_config: n.timeoutConfig ? { duration: n.timeoutConfig.duration, action: n.timeoutConfig.action } : null,
                        next_nodes: n.nextNodes || [],
                        position_x: n.x,
                        position_y: n.y
                    };
                })
            };

            fetch('/api/flows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(flowData)
            }).then(r => r.json()).then(data => {
                alert('流程保存成功！流程ID：' + data.id);
            }).catch(err => {
                alert('保存失败：' + err);
            });
        }

        function loadFlowList() {
            fetch('/api/flows').then(r => r.json()).then(flows => {
                var html = '已保存的流程：\n\n';
                flows.forEach(f => {
                    html += '• ' + f.name + ' (ID: ' + f.id + ')\n';
                });
                html += '\n输入流程ID加载：';
                var id = prompt(html);
                if (id) loadFlow(id);
            });
        }

        function loadFlow(id) {
            fetch('/api/flows/' + id).then(r => r.json()).then(fd => {
                nodes = [];
                connections = [];
                canvas.innerHTML = '';
                connectionsEl.innerHTML = '';
                fd.nodes.forEach(function(n) {
                    var node = {
                        id: n.id,
                        type: n.type,
                        name: n.name,
                        x: n.position_x || 100,
                        y: n.position_y || 100,
                        approvers: n.approvers || [],
                        conditions: n.conditions || [],
                        timeoutConfig: n.timeout_config,
                        nextNodes: n.next_nodes || []
                    };
                    nodes.push(node);
                    var num = parseInt(n.id.replace(/[^0-9]/g, ''));
                    if (!isNaN(num) && num >= nodeIdCounter) nodeIdCounter = num + 1;
                });
                nodes.forEach(function(n) {
                    renderNode(n);
                });
                syncConnectionsFromNodes();
                renderConnections();
                selectedNode = null;
                renderProperties();
                alert('流程加载成功！');
            }).catch(err => alert('加载失败：' + err));
        }

        canvas.addEventListener('click', (e) => {
            if (e.target === canvas) {
                document.querySelectorAll('.flow-node').forEach(el => el.classList.remove('selected'));
                selectedNode = null;
                renderProperties();
            }
        });
    </script>
</body>
</html>`
