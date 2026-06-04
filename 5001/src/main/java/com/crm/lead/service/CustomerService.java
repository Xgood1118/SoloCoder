package com.crm.lead.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.dto.CustomerDTO;
import com.crm.lead.dto.CustomerQueryDTO;
import com.crm.lead.entity.Customer;
import com.crm.lead.vo.CustomerDetailVO;

import java.util.List;

public interface CustomerService extends IService<Customer> {

    IPage<Customer> queryPage(CustomerQueryDTO queryDTO);

    CustomerDetailVO getDetail(Long id);

    Customer createCustomer(CustomerDTO dto);

    Customer updateCustomer(CustomerDTO dto);

    void deleteCustomer(Long id);

    List<Customer> checkDuplicate(String companyName, Long excludeId);

    String generateCustomerNo();
}
