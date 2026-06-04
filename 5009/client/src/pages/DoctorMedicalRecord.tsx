import React, { useState, useEffect } from "react";
import {
  Typography,
  Card,
  Form,
  Input,
  Button,
  Select,
  Table,
  InputNumber,
  message,
  Space,
  Divider,
  Tag,
} from "antd";
import { FileTextOutlined, PlusOutlined, DeleteOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { medicalRecordApi, prescriptionApi } from "../api";
import { Medicine } from "../types";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const DoctorMedicalRecord: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [prescriptionForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [medicineOptions, setMedicineOptions] = useState<Medicine[]>([]);
  const [prescriptionItems, setPrescriptionItems] = useState<any[]>([]);
  const [recordCreated, setRecordCreated] = useState(false);

  useEffect(() => {
    if (medicineSearch) {
      searchMedicine(medicineSearch);
    }
  }, [medicineSearch]);

  const searchMedicine = async (keyword: string) => {
    try {
      const res = await prescriptionApi.searchMedicine(keyword);
      setMedicineOptions(res.data.data);
    } catch (error) {
      console.error("搜索药品失败");
    }
  };

  const handleSubmitRecord = async (values: any) => {
    setLoading(true);
    try {
      await medicalRecordApi.create({
        appointmentId: parseInt(appointmentId!),
        ...values,
      });
      message.success("病历创建成功");
      setRecordCreated(true);
    } catch (error: any) {
      message.error(error.response?.data?.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  const addPrescriptionItem = () => {
    prescriptionForm.validateFields().then((values) => {
      const medicine = medicineOptions.find((m) => m.id === values.medicineId);
      if (medicine) {
        const newItem = {
          ...values,
          medicineName: medicine.name,
          specification: medicine.specification,
          unitPrice: medicine.unitPrice,
          totalPrice: medicine.unitPrice * values.quantity,
        };
        setPrescriptionItems([...prescriptionItems, newItem]);
        prescriptionForm.resetFields();
      }
    });
  };

  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  const handleCreatePrescription = async () => {
    if (prescriptionItems.length === 0) {
      message.warning("请添加药品");
      return;
    }

    try {
      // 先获取病历ID
      const recordRes = await medicalRecordApi.getByAppointment(
        parseInt(appointmentId!)
      );
      if (recordRes.data.data) {
        await prescriptionApi.create({
          medicalRecordId: recordRes.data.data.id,
          items: prescriptionItems,
        });
        message.success("处方开立成功");
        setPrescriptionItems([]);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || "创建处方失败");
    }
  };

  const prescriptionColumns = [
    {
      title: "药品名称",
      dataIndex: "medicineName",
      key: "medicineName",
    },
    {
      title: "规格",
      dataIndex: "specification",
      key: "specification",
    },
    {
      title: "数量",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "用法用量",
      key: "usage",
      render: (_: any, record: any) => (
        <span>
          {record.dosage} {record.frequency} {record.usage}
        </span>
      ),
    },
    {
      title: "单价",
      dataIndex: "unitPrice",
      key: "unitPrice",
      render: (price: number) => `¥${price}`,
    },
    {
      title: "小计",
      dataIndex: "totalPrice",
      key: "totalPrice",
      render: (price: number) => <Text strong>¥{price}</Text>,
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, __: any, index: number) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removePrescriptionItem(index)}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} className="page-title">
        <FileTextOutlined /> 接诊记录
      </Title>

      <Card title="病历信息" className="card-container">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitRecord}
          disabled={recordCreated}
        >
          <Form.Item
            label="主诉"
            name="chiefComplaint"
            rules={[{ required: true, message: "请输入主诉" }]}
          >
            <TextArea rows={2} placeholder="患者的主要症状" />
          </Form.Item>
          <Form.Item label="现病史" name="presentIllness">
            <TextArea rows={3} placeholder="详细描述病情" />
          </Form.Item>
          <Form.Item label="既往史" name="pastHistory">
            <TextArea rows={2} placeholder="患者既往病史" />
          </Form.Item>
          <Form.Item label="体格检查" name="physicalExamination">
            <TextArea rows={2} placeholder="体格检查结果" />
          </Form.Item>
          <Form.Item label="辅助检查" name="auxiliaryExamination">
            <TextArea rows={2} placeholder="化验、影像等检查结果" />
          </Form.Item>
          <Form.Item
            label="诊断"
            name="diagnosis"
            rules={[{ required: true, message: "请输入诊断" }]}
          >
            <TextArea rows={2} placeholder="诊断结论" />
          </Form.Item>
          <Form.Item label="治疗方案" name="treatmentPlan">
            <TextArea rows={2} placeholder="治疗建议" />
          </Form.Item>
          <Form.Item label="医嘱" name="doctorAdvice">
            <TextArea rows={2} placeholder="医嘱建议" />
          </Form.Item>
          {!recordCreated && (
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存病历
              </Button>
            </Form.Item>
          )}
          {recordCreated && (
            <Tag color="green">病历已保存</Tag>
          )}
        </Form>
      </Card>

      {recordCreated && (
        <>
          <Divider />
          <Card
            title={
              <span>
                <MedicineBoxOutlined /> 开具处方
              </span>
            }
            className="card-container"
          >
            <Form form={prescriptionForm} layout="inline">
              <Form.Item
                name="medicineId"
                rules={[{ required: true, message: "请选择药品" }]}
                style={{ width: 200 }}
              >
                <Select
                  showSearch
                  placeholder="搜索药品"
                  onSearch={setMedicineSearch}
                  filterOption={false}
                >
                  {medicineOptions.map((med) => (
                    <Option key={med.id} value={med.id}>
                      {med.name} - {med.specification}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="quantity"
                rules={[{ required: true, message: "请输入数量" }]}
              >
                <InputNumber min={1} placeholder="数量" />
              </Form.Item>
              <Form.Item name="dosage">
                <Input placeholder="剂量" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item name="frequency">
                <Select placeholder="频次" style={{ width: 120 }}>
                  <Option value="每日一次">每日一次</Option>
                  <Option value="每日二次">每日二次</Option>
                  <Option value="每日三次">每日三次</Option>
                  <Option value="饭前服用">饭前服用</Option>
                  <Option value="饭后服用">饭后服用</Option>
                </Select>
              </Form.Item>
              <Form.Item name="usage">
                <Input placeholder="用法" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={addPrescriptionItem}
                >
                  添加
                </Button>
              </Form.Item>
            </Form>

            <Table
              columns={prescriptionColumns}
              dataSource={prescriptionItems}
              rowKey="medicineId"
              pagination={false}
              style={{ marginTop: 16 }}
            />

            {prescriptionItems.length > 0 && (
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <Space>
                  <Text strong style={{ marginRight: 16 }}>
                    总计: ¥
                    {prescriptionItems
                      .reduce((sum, item) => sum + item.totalPrice, 0)
                      .toFixed(2)}
                  </Text>
                  <Button type="primary" onClick={handleCreatePrescription}>
                    开立处方
                  </Button>
                </Space>
              </div>
            )}
          </Card>
        </>
      )}

      <div style={{ marginTop: 24 }}>
        <Button onClick={() => navigate(-1)}>返回</Button>
      </div>
    </div>
  );
};

export default DoctorMedicalRecord;
