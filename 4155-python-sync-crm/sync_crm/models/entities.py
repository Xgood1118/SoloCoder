"""
业务实体数据模型
用于在同步过程中传递和处理数据
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum as PyEnum

from pydantic import BaseModel, Field, field_validator, ConfigDict


class CustomerLevel(str, PyEnum):
    """客户等级"""

    A = "A"
    B = "B"
    C = "C"
    D = "D"


class FollowStatus(str, PyEnum):
    """跟进状态"""

    NEW = "new"
    FOLLOWING = "following"
    CONTRACTED = "contracted"
    LOST = "lost"
    INACTIVE = "inactive"


class ContactStatus(str, PyEnum):
    """联系人状态"""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DEPARTED = "departed"


class LeadStatus(str, PyEnum):
    """线索状态"""

    NEW = "new"
    ASSIGNED = "assigned"
    FOLLOWING = "following"
    CONVERTED = "converted"
    INVALID = "invalid"


class OrderStatus(str, PyEnum):
    """订单状态"""

    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PAID = "paid"
    SHIPPED = "shipped"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SyncSourceMark:
    """同步来源标记混入（无Pydantic基类，混入字段到子类）"""

    sync_source: Optional[str] = Field(default=None, description="同步来源")
    origin: Optional[str] = Field(default=None, description="原始来源")


class Customer(SyncSourceMark, BaseModel):
    """客户主数据"""

    model_config = ConfigDict(from_attributes=True, extra="allow")

    id: Optional[str] = Field(default=None, description="CRM客户ID")
    remote_id: Optional[str] = Field(default=None, description="营销平台ID")
    company_name: str = Field(..., description="公司名称")
    company_alias: Optional[str] = Field(default=None, description="公司别名")
    industry: Optional[str] = Field(default=None, description="行业分类")
    customer_level: Optional[CustomerLevel] = Field(default=None, description="客户等级")
    follow_status: Optional[FollowStatus] = Field(default=None, description="跟进状态")
    region: Optional[str] = Field(default=None, description="地区")
    province: Optional[str] = Field(default=None, description="省份")
    city: Optional[str] = Field(default=None, description="城市")
    address: Optional[str] = Field(default=None, description="详细地址")
    postal_code: Optional[str] = Field(default=None, description="邮编")
    website: Optional[str] = Field(default=None, description="官网")
    business_license: Optional[str] = Field(default=None, description="营业执照号")
    owner_id: Optional[str] = Field(default=None, description="负责人ID")
    owner_name: Optional[str] = Field(default=None, description="负责人姓名")
    source_channel: Optional[str] = Field(default=None, description="来源渠道")
    remark: Optional[str] = Field(default=None, description="备注")
    created_at: Optional[datetime] = Field(default=None, description="创建时间")
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("公司名称不能为空")
        return v.strip()


class Contact(SyncSourceMark, BaseModel):
    """联系人数据"""

    model_config = ConfigDict(from_attributes=True, extra="allow")

    id: Optional[str] = Field(default=None, description="CRM联系人ID")
    remote_id: Optional[str] = Field(default=None, description="营销平台ID")
    customer_id: str = Field(..., description="所属客户ID")
    name: str = Field(..., description="姓名")
    gender: Optional[str] = Field(default=None, description="性别")
    position: Optional[str] = Field(default=None, description="职位")
    department: Optional[str] = Field(default=None, description="部门")
    phone: Optional[str] = Field(default=None, description="手机号")
    work_phone: Optional[str] = Field(default=None, description="工作电话")
    email: Optional[str] = Field(default=None, description="邮箱")
    wechat: Optional[str] = Field(default=None, description="微信号")
    qq: Optional[str] = Field(default=None, description="QQ号")
    is_default: bool = Field(default=False, description="是否默认联系人")
    status: ContactStatus = Field(default=ContactStatus.ACTIVE, description="状态")
    remark: Optional[str] = Field(default=None, description="备注")
    created_at: Optional[datetime] = Field(default=None, description="创建时间")
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("联系人姓名不能为空")
        return v.strip()


class Lead(SyncSourceMark, BaseModel):
    """销售线索"""

    model_config = ConfigDict(from_attributes=True, extra="allow")

    id: Optional[str] = Field(default=None, description="CRM线索ID")
    remote_id: Optional[str] = Field(default=None, description="营销平台ID")
    company_name: Optional[str] = Field(default=None, description="公司名称")
    contact_name: Optional[str] = Field(default=None, description="联系人姓名")
    phone: Optional[str] = Field(default=None, description="手机号")
    email: Optional[str] = Field(default=None, description="邮箱")
    wechat: Optional[str] = Field(default=None, description="微信号")
    industry: Optional[str] = Field(default=None, description="行业")
    region: Optional[str] = Field(default=None, description="地区")
    source: Optional[str] = Field(default=None, description="线索来源")
    campaign_id: Optional[str] = Field(default=None, description="营销活动ID")
    campaign_name: Optional[str] = Field(default=None, description="营销活动名称")
    lead_score: Optional[int] = Field(default=0, description="线索评分")
    status: LeadStatus = Field(default=LeadStatus.NEW, description="线索状态")
    owner_id: Optional[str] = Field(default=None, description="负责人ID")
    owner_name: Optional[str] = Field(default=None, description="负责人姓名")
    remark: Optional[str] = Field(default=None, description="备注")
    conflict_info: Optional[Dict[str, Any]] = Field(default=None, description="冲突信息")
    created_at: Optional[datetime] = Field(default=None, description="创建时间")
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")


class Order(SyncSourceMark, BaseModel):
    """订单数据"""

    model_config = ConfigDict(from_attributes=True, extra="allow")

    id: Optional[str] = Field(default=None, description="CRM订单ID")
    remote_id: Optional[str] = Field(default=None, description="营销平台ID")
    order_no: str = Field(..., description="订单编号")
    customer_id: str = Field(..., description="客户ID")
    customer_name: Optional[str] = Field(default=None, description="客户名称")
    contact_id: Optional[str] = Field(default=None, description="联系人ID")
    contact_name: Optional[str] = Field(default=None, description="联系人姓名")
    opportunity_id: Optional[str] = Field(default=None, description="商机ID")
    order_amount: float = Field(default=0.0, description="订单金额(元)")
    contract_amount: Optional[float] = Field(default=None, description="合同金额(元)")
    paid_amount: Optional[float] = Field(default=None, description="已付金额(元)")
    sign_date: Optional[datetime] = Field(default=None, description="签约日期")
    contract_start_date: Optional[datetime] = Field(default=None, description="合同开始日期")
    contract_end_date: Optional[datetime] = Field(default=None, description="合同结束日期")
    contract_term_months: Optional[int] = Field(default=None, description="合同期限(月)")
    status: OrderStatus = Field(default=OrderStatus.DRAFT, description="订单状态")
    payment_method: Optional[str] = Field(default=None, description="付款方式")
    product_name: Optional[str] = Field(default=None, description="产品名称")
    is_first_order: bool = Field(default=False, description="是否首单")
    remark: Optional[str] = Field(default=None, description="备注")
    created_at: Optional[datetime] = Field(default=None, description="创建时间")
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")
