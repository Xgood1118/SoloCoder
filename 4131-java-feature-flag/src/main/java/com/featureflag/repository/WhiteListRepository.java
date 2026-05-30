package com.featureflag.repository;

import com.featureflag.entity.WhiteList;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WhiteListRepository extends JpaRepository<WhiteList, Long> {

    List<WhiteList> findByFeatureFlagId(Long featureFlagId);

    @Query("SELECT w FROM WhiteList w WHERE w.featureFlag.id = :flagId AND (w.userId = :userId OR w.userTag IN :userTags)")
    List<WhiteList> findMatchingWhiteList(@Param("flagId") Long flagId,
                                          @Param("userId") String userId,
                                          @Param("userTags") List<String> userTags);

    void deleteByFeatureFlagId(Long featureFlagId);
}
