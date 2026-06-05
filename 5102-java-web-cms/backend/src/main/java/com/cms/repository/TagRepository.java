package com.cms.repository;

import com.cms.entity.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TagRepository extends JpaRepository<Tag, String> {

    Page<Tag> findByNameContaining(String name, Pageable pageable);

    List<Tag> findByNameContaining(String name);
}
