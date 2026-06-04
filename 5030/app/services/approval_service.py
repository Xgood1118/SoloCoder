from sqlalchemy.orm import Session
from app.models import ApprovalNode, Employee


APPROVAL_TRANSFER_CONFIG = {
    "version": "1.0",
    "note": "审批节点流转条件配置，以下为临时实现，需HR确认",
    "condition_types": {
        "amount": "按金额阈值判断",
        "department": "按部门判断",
        "category": "按类别判断",
        "level": "按级别判断",
        "days": "按天数判断"
    },
    "pending_confirmation": [
        "流转条件的优先级？多个条件同时满足时如何处理？",
        "条件不匹配时是跳过节点还是报错？",
        "金额阈值是大于等于还是大于？",
        "部门条件是包含还是等于？",
        "是否支持多条件组合（AND/OR逻辑）？"
    ]
}


def evaluate_transfer_condition(
    node: ApprovalNode,
    form_data: dict,
    employee: Employee
) -> bool:
    if not node.condition_type or not node.condition_value:
        return True
    
    condition_type = node.condition_type
    condition_value = node.condition_value
    
    try:
        if condition_type == "amount":
            threshold = float(condition_value)
            actual_amount = float(form_data.get("amount", 0))
            return actual_amount >= threshold
        
        elif condition_type == "department":
            target_departments = condition_value.split(",")
            return employee.department in target_departments
        
        elif condition_type == "category":
            target_categories = condition_value.split(",")
            actual_category = form_data.get("category", "")
            return actual_category in target_categories
        
        elif condition_type == "level":
            target_levels = condition_value.split(",")
            actual_level = form_data.get("level", "")
            return actual_level in target_levels
        
        elif condition_type == "days":
            threshold = int(condition_value)
            actual_days = int(form_data.get("days", 0))
            return actual_days >= threshold
        
        else:
            return True
            
    except (ValueError, TypeError):
        return True


def get_next_approval_node(
    flow_id: int,
    current_node: ApprovalNode,
    form_data: dict,
    employee: Employee,
    db: Session
):
    all_nodes = db.query(ApprovalNode).filter(
        ApprovalNode.flow_id == flow_id
    ).order_by(ApprovalNode.node_order).all()
    
    if not all_nodes:
        return None
    
    if current_node is None:
        for node in all_nodes:
            if evaluate_transfer_condition(node, form_data, employee):
                return node
        return None
    
    current_index = None
    for i, node in enumerate(all_nodes):
        if node.id == current_node.id:
            current_index = i
            break
    
    if current_index is None:
        return None
    
    for i in range(current_index + 1, len(all_nodes)):
        next_node = all_nodes[i]
        if evaluate_transfer_condition(next_node, form_data, employee):
            return next_node
    
    return None


def get_approval_flow_documentation() -> dict:
    return {
        "config": APPROVAL_TRANSFER_CONFIG,
        "example_flows": [
            {
                "name": "请假审批流",
                "nodes": [
                    {
                        "node_name": "部门主管审批",
                        "node_order": 1,
                        "condition_type": None,
                        "condition_value": None
                    },
                    {
                        "node_name": "HR审批",
                        "node_order": 2,
                        "condition_type": "days",
                        "condition_value": "3"
                    },
                    {
                        "node_name": "总经理审批",
                        "node_order": 3,
                        "condition_type": "days",
                        "condition_value": "7"
                    }
                ]
            },
            {
                "name": "采购审批流",
                "nodes": [
                    {
                        "node_name": "部门经理审批",
                        "node_order": 1,
                        "condition_type": None,
                        "condition_value": None
                    },
                    {
                        "node_name": "财务审批",
                        "node_order": 2,
                        "condition_type": "amount",
                        "condition_value": "1000"
                    },
                    {
                        "node_name": "CFO审批",
                        "node_order": 3,
                        "condition_type": "amount",
                        "condition_value": "10000"
                    }
                ]
            }
        ]
    }
