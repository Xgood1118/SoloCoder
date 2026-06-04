package com.crm.lead.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.common.PageResult;
import com.crm.lead.common.Result;
import com.crm.lead.dto.CustomerDTO;
import com.crm.lead.dto.CustomerQueryDTO;
import com.crm.lead.entity.Customer;
import com.crm.lead.service.CustomerService;
import com.crm.lead.vo.CustomerDetailVO;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "客户管理")
@RestController
@RequestMapping("/customer")
public class CustomerController {

    @Autowired
    private CustomerService customerService;

    @ApiOperation("分页查询客户列表")
    @GetMapping("/page")
    public Result<PageResult<Customer>> queryPage(CustomerQueryDTO queryDTO) {
        IPage<Customer> page = customerService.queryPage(queryDTO);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(),
                queryDTO.getPageNum(), queryDTO.getPageSize()));
    }

    @ApiOperation("获取客户详情")
    @GetMapping("/{id}")
    public Result<CustomerDetailVO> getDetail(@PathVariable Long id) {
        return Result.success(customerService.getDetail(id));
    }

    @ApiOperation("新增客户")
    @PostMapping
    public Result<Customer> createCustomer(@Validated @RequestBody CustomerDTO dto) {
        return Result.success(customerService.createCustomer(dto));
    }

    @ApiOperation("更新客户")
    @PutMapping
    public Result<Customer> updateCustomer(@Validated @RequestBody CustomerDTO dto) {
        return Result.success(customerService.updateCustomer(dto));
    }

    @ApiOperation("删除客户")
    @DeleteMapping("/{id}")
    public Result<Void> deleteCustomer(@PathVariable Long id) {
        customerService.deleteCustomer(id);
        return Result.success();
    }

    @ApiOperation("检查同名公司（重复录入检测）")
    @GetMapping("/check-duplicate")
    public Result<List<Customer>> checkDuplicate(@RequestParam String companyName,
                                                 @RequestParam(required = false) Long excludeId) {
        return Result.success(customerService.checkDuplicate(companyName, excludeId));
    }

    @ApiOperation("生成客户档案编号")
    @GetMapping("/generate-no")
    public Result<String> generateCustomerNo() {
        return Result.success(customerService.generateCustomerNo());
    }
}
