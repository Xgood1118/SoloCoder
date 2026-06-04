package com.crm.lead.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.dto.*;
import com.crm.lead.entity.*;
import com.crm.lead.exception.BusinessException;
import com.crm.lead.mapper.*;
import com.crm.lead.service.CustomerService;
import com.crm.lead.vo.CustomerDetailVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CustomerServiceImpl extends ServiceImpl<CustomerMapper, Customer> implements CustomerService {

    @Autowired
    private CustomerContactMapper contactMapper;
    @Autowired
    private CustomerLicenseMapper licenseMapper;
    @Autowired
    private CustomerDecisionChainMapper decisionChainMapper;
    @Autowired
    private SalesLeadMapper leadMapper;

    @Override
    public IPage<Customer> queryPage(CustomerQueryDTO queryDTO) {
        LambdaQueryWrapper<Customer> wrapper = new LambdaQueryWrapper<>();
        if (StrUtil.isNotBlank(queryDTO.getCompanyName())) {
            wrapper.like(Customer::getCompanyName, queryDTO.getCompanyName());
        }
        if (queryDTO.getCustomerType() != null) {
            wrapper.eq(Customer::getCustomerType, queryDTO.getCustomerType());
        }
        if (StrUtil.isNotBlank(queryDTO.getIndustryCode())) {
            wrapper.eq(Customer::getIndustryCode, queryDTO.getIndustryCode());
        }
        if (queryDTO.getCityId() != null) {
            wrapper.eq(Customer::getCityId, queryDTO.getCityId());
        }
        if (queryDTO.getCustomerStatus() != null) {
            wrapper.eq(Customer::getCustomerStatus, queryDTO.getCustomerStatus());
        }
        wrapper.orderByDesc(Customer::getCreatedTime);
        return page(new Page<>(queryDTO.getPageNum(), queryDTO.getPageSize()), wrapper);
    }

    @Override
    public CustomerDetailVO getDetail(Long id) {
        Customer customer = getById(id);
        if (customer == null) {
            throw new BusinessException("客户不存在");
        }
        CustomerDetailVO vo = new CustomerDetailVO();
        BeanUtil.copyProperties(customer, vo);

        List<CustomerContact> contacts = contactMapper.selectList(
            new LambdaQueryWrapper<CustomerContact>()
                .eq(CustomerContact::getCustomerId, id)
                .eq(CustomerContact::getIsDeleted, 0)
                .orderByAsc(CustomerContact::getContactRole)
        );
        vo.setContacts(contacts);

        List<CustomerLicense> licenses = licenseMapper.selectList(
            new LambdaQueryWrapper<CustomerLicense>()
                .eq(CustomerLicense::getCustomerId, id)
                .eq(CustomerLicense::getIsDeleted, 0)
                .orderByDesc(CustomerLicense::getCreatedTime)
        );
        vo.setLicenses(licenses);

        List<CustomerDecisionChain> chains = decisionChainMapper.selectList(
            new LambdaQueryWrapper<CustomerDecisionChain>()
                .eq(CustomerDecisionChain::getCustomerId, id)
                .eq(CustomerDecisionChain::getIsDeleted, 0)
                .orderByAsc(CustomerDecisionChain::getSortOrder)
        );
        vo.setDecisionChains(chains);

        List<SalesLead> leads = leadMapper.selectList(
            new LambdaQueryWrapper<SalesLead>()
                .eq(SalesLead::getCustomerId, id)
                .eq(SalesLead::getIsDeleted, 0)
                .orderByDesc(SalesLead::getCreatedTime)
        );
        vo.setLeads(leads);

        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Customer createCustomer(CustomerDTO dto) {
        List<Customer> duplicates = checkDuplicate(dto.getCompanyName(), null);
        if (!duplicates.isEmpty()) {
            throw new BusinessException("检测到同名公司：" + duplicates.get(0).getCompanyName() + "，请确认是否重复录入");
        }

        Customer customer = new Customer();
        BeanUtil.copyProperties(dto, customer);
        customer.setCustomerStatus(1);
        customer.setCreatedTime(new Date());
        customer.setUpdatedTime(new Date());
        save(customer);

        saveContacts(customer.getId(), dto.getContacts());
        saveLicenses(customer.getId(), dto.getLicenses());
        saveDecisionChains(customer.getId(), dto.getDecisionChains());

        return customer;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Customer updateCustomer(CustomerDTO dto) {
        Customer customer = getById(dto.getId());
        if (customer == null) {
            throw new BusinessException("客户不存在");
        }

        if (!dto.getCompanyName().equals(customer.getCompanyName())) {
            List<Customer> duplicates = checkDuplicate(dto.getCompanyName(), dto.getId());
            if (!duplicates.isEmpty()) {
                throw new BusinessException("检测到同名公司：" + duplicates.get(0).getCompanyName() + "，请确认是否重复录入");
            }
        }

        BeanUtil.copyProperties(dto, customer);
        customer.setUpdatedTime(new Date());
        updateById(customer);

        contactMapper.delete(new LambdaQueryWrapper<CustomerContact>().eq(CustomerContact::getCustomerId, dto.getId()));
        saveContacts(dto.getId(), dto.getContacts());

        licenseMapper.delete(new LambdaQueryWrapper<CustomerLicense>().eq(CustomerLicense::getCustomerId, dto.getId()));
        saveLicenses(dto.getId(), dto.getLicenses());

        decisionChainMapper.delete(new LambdaQueryWrapper<CustomerDecisionChain>().eq(CustomerDecisionChain::getCustomerId, dto.getId()));
        saveDecisionChains(dto.getId(), dto.getDecisionChains());

        return customer;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteCustomer(Long id) {
        Customer customer = getById(id);
        if (customer == null) {
            throw new BusinessException("客户不存在");
        }

        Integer activeLeadCount = leadMapper.selectCount(
            new LambdaQueryWrapper<SalesLead>()
                .eq(SalesLead::getCustomerId, id)
                .eq(SalesLead::getIsDeleted, 0)
                .notIn(SalesLead::getLeadStatus, "CLOSED", "DEALED")
        ).intValue();

        if (activeLeadCount > 0) {
            throw new BusinessException("该客户下存在" + activeLeadCount + "条未关闭线索，无法删除");
        }

        removeById(id);
    }

    @Override
    public List<Customer> checkDuplicate(String companyName, Long excludeId) {
        LambdaQueryWrapper<Customer> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Customer::getCompanyName, companyName)
               .eq(Customer::getIsDeleted, 0);
        if (excludeId != null) {
            wrapper.ne(Customer::getId, excludeId);
        }
        return list(wrapper);
    }

    @Override
    public String generateCustomerNo() {
        String prefix = "C" + DateUtil.format(new Date(), "yyyyMMdd");
        LambdaQueryWrapper<Customer> wrapper = new LambdaQueryWrapper<>();
        wrapper.likeRight(Customer::getCustomerNo, prefix)
               .orderByDesc(Customer::getCustomerNo)
               .last("LIMIT 1");
        Customer lastCustomer = getOne(wrapper);
        int sequence = 1;
        if (lastCustomer != null && StrUtil.isNotBlank(lastCustomer.getCustomerNo())) {
            String num = lastCustomer.getCustomerNo().substring(prefix.length());
            try {
                sequence = Integer.parseInt(num) + 1;
            } catch (NumberFormatException e) {
                sequence = 1;
            }
        }
        return prefix + String.format("%04d", sequence);
    }

    private void saveContacts(Long customerId, List<CustomerContactDTO> contacts) {
        if (contacts == null || contacts.isEmpty()) {
            return;
        }
        for (CustomerContactDTO contactDTO : contacts) {
            CustomerContact contact = new CustomerContact();
            BeanUtil.copyProperties(contactDTO, contact);
            contact.setCustomerId(customerId);
            contact.setIsDeleted(0);
            contact.setCreatedTime(new Date());
            contact.setUpdatedTime(new Date());
            contactMapper.insert(contact);
        }
    }

    private void saveLicenses(Long customerId, List<CustomerLicenseDTO> licenses) {
        if (licenses == null || licenses.isEmpty()) {
            return;
        }
        for (CustomerLicenseDTO licenseDTO : licenses) {
            CustomerLicense license = new CustomerLicense();
            BeanUtil.copyProperties(licenseDTO, license);
            license.setCustomerId(customerId);
            license.setIsDeleted(0);
            license.setCreatedTime(new Date());
            license.setUpdatedTime(new Date());
            licenseMapper.insert(license);
        }
    }

    private void saveDecisionChains(Long customerId, List<CustomerDecisionChainDTO> chains) {
        if (chains == null || chains.isEmpty()) {
            return;
        }
        for (CustomerDecisionChainDTO chainDTO : chains) {
            CustomerDecisionChain chain = new CustomerDecisionChain();
            BeanUtil.copyProperties(chainDTO, chain);
            chain.setCustomerId(customerId);
            chain.setIsDeleted(0);
            chain.setCreatedTime(new Date());
            chain.setUpdatedTime(new Date());
            decisionChainMapper.insert(chain);
        }
    }
}
