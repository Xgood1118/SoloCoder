package com.crm.lead.engine;

import com.crm.lead.entity.SalesLead;
import com.crm.lead.entity.SalesRegionIndustry;
import com.crm.lead.entity.Salesperson;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AllocationScore {

    private Long salespersonId;

    private Integer priorityScore;

    private Integer loadScore;

    private Long timeScore;

    private Integer totalScore;

    public static List<AllocationScore> calculate(List<Salesperson> candidates, SalesLead lead,
                                                  Map<Long, List<SalesRegionIndustry>> salespersonRegions,
                                                  Map<Long, Date> lastAssignTimeMap) {
        Integer importanceLevel = lead.getImportanceLevel();

        return candidates.stream().map(salesperson -> {
            AllocationScore score = new AllocationScore();
            score.setSalespersonId(salesperson.getId());

            int priorityWeight = 0;
            List<SalesRegionIndustry> regions = salespersonRegions.get(salesperson.getId());
            if (regions != null) {
                for (SalesRegionIndustry region : regions) {
                    if (region.getRegionId().equals(lead.getCityId())
                            && region.getIndustryCode().equals(lead.getIndustryCode())) {
                        priorityWeight = region.getPriority() != null ? region.getPriority() : 1;
                        break;
                    }
                }
            }
            score.setPriorityScore(importanceLevel * 10 + priorityWeight);

            int loadWeight = salesperson.getMaxLoad() - salesperson.getCurrentLeadCount();
            score.setLoadScore(loadWeight);

            Date lastAssignTime = lastAssignTimeMap.get(salesperson.getId());
            long timeWeight = lastAssignTime != null
                    ? (System.currentTimeMillis() - lastAssignTime.getTime()) / 60000
                    : Long.MAX_VALUE;
            score.setTimeScore(timeWeight);

            int total = score.getPriorityScore() * 100 + score.getLoadScore() * 10 + (int) Math.min(timeWeight, 9999);
            score.setTotalScore(total);

            return score;
        }).sorted(Comparator.comparing(AllocationScore::getTotalScore).reversed())
                .collect(Collectors.toList());
    }
}
