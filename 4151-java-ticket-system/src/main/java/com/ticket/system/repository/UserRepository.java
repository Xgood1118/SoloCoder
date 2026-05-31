package com.ticket.system.repository;

import com.ticket.system.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByUsername(String username);

    List<User> findByDepartmentIdAndEnabledTrue(Long departmentId);

    @Query("SELECT u FROM User u JOIN u.roles r WHERE r = ?1 AND u.enabled = true")
    List<User> findByRole(User.Role role);

    @Query("SELECT u FROM User u JOIN u.roles r WHERE r IN ?1 AND u.enabled = true")
    List<User> findByRolesIn(List<User.Role> roles);

    List<User> findByLevelAndEnabledTrue(Integer level);

    boolean existsByUsername(String username);
}
