package com.oauth2.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.oauth2.server.entity.ApiQuota;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.Optional;

public interface ApiQuotaMapper extends BaseMapper<ApiQuota> {

    @Select("SELECT * FROM api_quota WHERE client_id = #{clientId} AND quota_date = #{quotaDate} AND deleted = 0")
    Optional<ApiQuota> selectByClientIdAndDate(@Param("clientId") String clientId, @Param("quotaDate") String quotaDate);

    @Update("UPDATE api_quota SET daily_used = daily_used + 1, hourly_used = hourly_used + 1, minute_used = minute_used + 1 " +
            "WHERE client_id = #{clientId} AND quota_date = #{quotaDate}")
    void incrementUsed(@Param("clientId") String clientId, @Param("quotaDate") String quotaDate);

    @Update("UPDATE api_quota SET minute_used = 0 WHERE client_id = #{clientId} AND quota_date = #{quotaDate}")
    void resetMinuteUsed(@Param("clientId") String clientId, @Param("quotaDate") String quotaDate);

    @Update("UPDATE api_quota SET hourly_used = 0, minute_used = 0 WHERE client_id = #{clientId} AND quota_date = #{quotaDate}")
    void resetHourlyUsed(@Param("clientId") String clientId, @Param("quotaDate") String quotaDate);
}
