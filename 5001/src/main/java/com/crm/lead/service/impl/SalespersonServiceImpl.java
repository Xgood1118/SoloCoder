package com.crm.lead.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.vo.SalespersonVO;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.entity.SalesRegionIndustry;
import com.crm.lead.entity.Salesperson;
import com.crm.lead.exception.BusinessException;
import com.crm.lead.mapper.SalesLeadMapper;
import com.crm.lead.mapper.SalesRegionIndustryMapper;
import com.crm.lead.mapper.SalespersonMapper;
import com.crm.lead.service.SalesRegionIndustryService;
import com.crm.lead.service.SalespersonService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SalespersonServiceImpl extends ServiceImpl<SalespersonMapper, Salesperson> implements SalespersonService {

    @Autowired
    private SalesRegionIndustryMapper regionIndustryMapper;

    @Autowired
    private SalesRegionIndustryService regionIndustryService;

    @Autowired
    private SalesLeadMapper leadMapper;

    @Override
    public IPage<Salesperson> queryPage(String keyword, Integer pageNum, Integer pageSize) {
        LambdaQueryWrapper<Salesperson> wrapper = new LambdaQueryWrapper<>();
        if (StrUtil.isNotBlank(keyword)) {
            wrapper.and(w -> w.like(Salesperson::getName, keyword)
                    .or().like(Salesperson::getSalesNo, keyword)
                    .or().like(Salesperson::getPhone, keyword)
                    .or().like(Salesperson::getDepartment, keyword));
        }
        wrapper.orderByDesc(Salesperson::getCreatedTime);
        return page(new Page<>(pageNum, pageSize), wrapper);
    }

    @Override
    public SalespersonVO getDetail(Long id) {
        Salesperson salesperson = getById(id);
        if (salesperson == null) {
            throw new BusinessException("销售人员不存在");
        }
        SalespersonVO vo = new SalespersonVO();
        BeanUtil.copyProperties(salesperson, vo);

        List<SalesRegionIndustry> regionIndustries = regionIndustryService.getBySalespersonId(id);
        vo.setRegionIndustries(regionIndustries);

        if (salesperson.getMaxLoad() != null && salesperson.getMaxLoad() > 0) {
            BigDecimal loadRate = BigDecimal.valueOf(salesperson.getCurrentLeadCount())
                    .divide(BigDecimal.valueOf(salesperson.getMaxLoad()), 2, RoundingMode.HALF_UP);
            vo.setCurrentLoadRate(loadRate);
        } else {
            vo.setCurrentLoadRate(BigDecimal.ZERO);
        }

        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Salesperson create(Salesperson salesperson) {
        salesperson.setCreatedTime(new Date());
        salesperson.setUpdatedTime(new Date());
        if (salesperson.getCurrentLeadCount() == null) {
            salesperson.setCurrentLeadCount(0);
        }
        if (salesperson.getIsEligible() == null) {
            salesperson.setIsEligible(1);
        }
        save(salesperson);
        return salesperson;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Salesperson update(Salesperson salesperson) {
        Salesperson exist = getById(salesperson.getId());
        if (exist == null) {
            throw new BusinessException("销售人员不存在");
        }
        salesperson.setUpdatedTime(new Date());
        updateById(salesperson);
        return salesperson;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        Salesperson salesperson = getById(id);
        if (salesperson == null) {
            throw new BusinessException("销售人员不存在");
        }

        Integer activeLeadCount = leadMapper.selectCount(
                new LambdaQueryWrapper<SalesLead>()
                        .eq(SalesLead::getSalespersonId, id)
                        .ne(SalesLead::getLeadStatus, "CLOSED")
                        .ne(SalesLead::getLeadStatus, "DEALED")
        ).intValue();

        if (activeLeadCount > 0) {
            throw new BusinessException("该销售名下存在" + activeLeadCount + "条未关闭线索，无法删除");
        }

        regionIndustryMapper.delete(
                new LambdaQueryWrapper<SalesRegionIndustry>()
                        .eq(SalesRegionIndustry::getSalespersonId, id)
        );

        removeById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateCurrentLeadCount(Long salespersonId) {
        Salesperson salesperson = getById(salespersonId);
        if (salesperson == null) {
            return;
        }

        Integer count = leadMapper.selectCount(
                new LambdaQueryWrapper<SalesLead>()
                        .eq(SalesLead::getSalespersonId, salespersonId)
                        .ne(SalesLead::getLeadStatus, "CLOSED")
                        .ne(SalesLead::getLeadStatus, "DEALED")
        ).intValue();

        salesperson.setCurrentLeadCount(count);
        salesperson.setUpdatedTime(new Date());

        if (count <= salesperson.getRecoverThreshold()) {
            salesperson.setIsEligible(1);
        }

        updateById(salesperson);
    }

    @Override
    public boolean isLoadAvailable(Long salespersonId) {
        Salesperson salesperson = getById(salespersonId);
        if (salesperson == null) {
            return false;
        }
        if (salesperson.getIsActive() == null || salesperson.getIsActive() != 1) {
            return false;
        }
        if (salesperson.getIsEligible() == null || salesperson.getIsEligible() != 1) {
            return false;
        }
        return salesperson.getCurrentLeadCount() < salesperson.getMaxLoad();
    }

    @Override
    public List<SalespersonVO> getEligibleSalespersons(Long cityId, String industryCode, Integer importanceLevel) {
        LambdaQueryWrapper<SalesRegionIndustry> wrapper = new LambdaQueryWrapper<>();
        if (cityId != null) {
            wrapper.eq(SalesRegionIndustry::getRegionId, cityId);
        }
        if (StrUtil.isNotBlank(industryCode)) {
            wrapper.eq(SalesRegionIndustry::getIndustryCode, industryCode);
        }
        wrapper.orderByAsc(SalesRegionIndustry::getPriority);

        List<SalesRegionIndustry> regionIndustries = regionIndustryMapper.selectList(wrapper);

        List<Long> salespersonIds = regionIndustries.stream()
                .map(SalesRegionIndustry::getSalespersonId)
                .distinct()
                .collect(Collectors.toList());

        if (salespersonIds.isEmpty()) {
            return java.util.Collections.emptyList();
        }

        List<Salesperson> salespersons = list(
                new LambdaQueryWrapper<Salesperson>()
                        .in(Salesperson::getId, salespersonIds)
                        .eq(Salesperson::getIsActive, 1)
                        .eq(Salesperson::getIsEligible, 1)
        );

        return salespersons.stream()
                .filter(s -> isLoadAvailable(s.getId()))
                .map(s -> {
                    SalespersonVO vo = new SalespersonVO();
                    BeanUtil.copyProperties(s, vo);

                    List<SalesRegionIndustry> ri = regionIndustries.stream()
                            .filter(r -> r.getSalespersonId().equals(s.getId()))
                            .collect(Collectors.toList());
                    vo.setRegionIndustries(ri);

                    if (s.getMaxLoad() != null && s.getMaxLoad() > 0) {
                        BigDecimal loadRate = BigDecimal.valueOf(s.getCurrentLeadCount())
                                .divide(BigDecimal.valueOf(s.getMaxLoad()), 2, RoundingMode.HALF_UP);
                        vo.setCurrentLoadRate(loadRate);
                    } else {
                        vo.setCurrentLoadRate(BigDecimal.ZERO);
                    }

                    return vo;
                })
                .sorted(Comparator.comparing((SalespersonVO vo) -> {
                    if (vo.getRegionIndustries() != null && !vo.getRegionIndustries().isEmpty()) {
                        return vo.getRegionIndustries().get(0).getPriority();
                    }
                    return Integer.MAX_VALUE;
                }).thenComparing(vo -> {
                    if (vo.getCurrentLeadCount() != null && vo.getMaxLoad() != null && vo.getMaxLoad() > 0) {
                        return BigDecimal.valueOf(vo.getCurrentLeadCount())
                                .divide(BigDecimal.valueOf(vo.getMaxLoad()), 2, RoundingMode.HALF_UP);
                    }
                    return BigDecimal.ZERO;
                }))
                .collect(Collectors.toList());
    }
}
