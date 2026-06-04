import React from "react";
import { Card, Typography } from "antd";

const { Title } = Typography;

const Home: React.FC = () => {
  return (
    <div>
      <Title level={2} className="page-title">
        欢迎使用医院挂号管理系统
      </Title>
      <Card className="card-container">
        <p>请从左侧菜单选择功能</p>
      </Card>
    </div>
  );
};

export default Home;
