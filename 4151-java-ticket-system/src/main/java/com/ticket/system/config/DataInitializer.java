package com.ticket.system.config;

import com.ticket.system.entity.TicketCategory;
import com.ticket.system.entity.User;
import com.ticket.system.repository.TicketCategoryRepository;
import com.ticket.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final TicketCategoryRepository categoryRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        log.info("Starting data initialization...");
        
        initUsers();
        initCategories();
        
        log.info("Data initialization completed.");
    }

    private void initUsers() {
        if (userRepository.count() == 0) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setRealName("系统管理员");
            admin.setEmail("admin@example.com");
            admin.setPhone("13800138000");
            admin.setRoles(Set.of(User.Role.ADMIN, User.Role.AGENT));
            admin.setEnabled(true);
            admin.setLevel(3);
            userRepository.save(admin);
            log.info("Created admin user: admin/admin123");

            User agent = new User();
            agent.setUsername("agent1");
            agent.setPassword(passwordEncoder.encode("agent123"));
            agent.setRealName("客服小张");
            agent.setEmail("agent1@example.com");
            agent.setPhone("13800138001");
            agent.setRoles(Set.of(User.Role.AGENT));
            agent.setEnabled(true);
            agent.setLevel(1);
            userRepository.save(agent);
            log.info("Created agent user: agent1/agent123");

            User customer = new User();
            customer.setUsername("customer1");
            customer.setPassword(passwordEncoder.encode("customer123"));
            customer.setRealName("客户小李");
            customer.setEmail("customer1@example.com");
            customer.setPhone("13900139000");
            customer.setRoles(Set.of(User.Role.CUSTOMER));
            customer.setEnabled(true);
            userRepository.save(customer);
            log.info("Created customer user: customer1/customer123");

            User supervisor = new User();
            supervisor.setUsername("supervisor");
            supervisor.setPassword(passwordEncoder.encode("super123"));
            supervisor.setRealName("客服主管");
            supervisor.setEmail("supervisor@example.com");
            supervisor.setPhone("13800138002");
            supervisor.setRoles(Set.of(User.Role.SUPERVISOR, User.Role.AGENT));
            supervisor.setEnabled(true);
            supervisor.setLevel(2);
            userRepository.save(supervisor);
            log.info("Created supervisor user: supervisor/super123");
        }
    }

    private void initCategories() {
        if (categoryRepository.count() == 0) {
            TicketCategory techCategory = new TicketCategory();
            techCategory.setName("技术问题");
            techCategory.setCode("TECH");
            techCategory.setDescription("各类技术相关问题");
            techCategory.setLevel(1);
            techCategory.setSortOrder(1);
            techCategory.setEnabled(true);
            techCategory = categoryRepository.save(techCategory);
            log.info("Created category: 技术问题");

            TicketCategory networkCategory = new TicketCategory();
            networkCategory.setName("网络问题");
            networkCategory.setCode("TECH_NETWORK");
            networkCategory.setDescription("网络连接、网速等问题");
            networkCategory.setParentId(techCategory.getId());
            networkCategory.setLevel(2);
            networkCategory.setSortOrder(1);
            networkCategory.setEnabled(true);
            categoryRepository.save(networkCategory);
            log.info("Created sub-category: 网络问题");

            TicketCategory serverCategory = new TicketCategory();
            serverCategory.setName("服务器问题");
            serverCategory.setCode("TECH_SERVER");
            serverCategory.setDescription("服务器宕机、性能等问题");
            serverCategory.setParentId(techCategory.getId());
            serverCategory.setLevel(2);
            serverCategory.setSortOrder(2);
            serverCategory.setEnabled(true);
            categoryRepository.save(serverCategory);
            log.info("Created sub-category: 服务器问题");

            TicketCategory softwareCategory = new TicketCategory();
            softwareCategory.setName("软件问题");
            softwareCategory.setCode("TECH_SOFTWARE");
            softwareCategory.setDescription("应用软件、系统软件问题");
            softwareCategory.setParentId(techCategory.getId());
            softwareCategory.setLevel(2);
            softwareCategory.setSortOrder(3);
            softwareCategory.setEnabled(true);
            categoryRepository.save(softwareCategory);
            log.info("Created sub-category: 软件问题");

            TicketCategory bizCategory = new TicketCategory();
            bizCategory.setName("业务咨询");
            bizCategory.setCode("BIZ");
            bizCategory.setDescription("业务相关咨询");
            bizCategory.setLevel(1);
            bizCategory.setSortOrder(2);
            bizCategory.setEnabled(true);
            categoryRepository.save(bizCategory);
            log.info("Created category: 业务咨询");

            TicketCategory complaintCategory = new TicketCategory();
            complaintCategory.setName("投诉建议");
            complaintCategory.setCode("COMPLAINT");
            complaintCategory.setDescription("客户投诉与建议");
            complaintCategory.setLevel(1);
            complaintCategory.setSortOrder(3);
            complaintCategory.setEnabled(true);
            categoryRepository.save(complaintCategory);
            log.info("Created category: 投诉建议");
        }
    }
}
