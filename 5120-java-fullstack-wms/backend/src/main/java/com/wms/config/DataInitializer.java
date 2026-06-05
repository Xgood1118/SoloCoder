package com.wms.config;

import com.wms.entity.User;
import com.wms.entity.Warehouse;
import com.wms.repository.UserRepository;
import com.wms.repository.WarehouseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("dev")
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (warehouseRepository.count() == 0) {
            Warehouse wh1 = new Warehouse();
            wh1.setName("主仓库");
            wh1.setCode("WH001");
            wh1.setLocation("A区1号楼");
            wh1.setManager("张三");
            warehouseRepository.save(wh1);

            Warehouse wh2 = new Warehouse();
            wh2.setName("二号仓库");
            wh2.setCode("WH002");
            wh2.setLocation("B区2号楼");
            wh2.setManager("李四");
            warehouseRepository.save(wh2);

            System.out.println("已初始化仓库数据");
        }

        if (userRepository.count() == 0) {
            String defaultPassword = passwordEncoder.encode("123456");

            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(defaultPassword);
            admin.setRealName("系统管理员");
            admin.setRole("ADMIN");
            admin.setWarehouseId(null);
            admin.setEnabled(true);
            userRepository.save(admin);

            User operator = new User();
            operator.setUsername("operator1");
            operator.setPassword(defaultPassword);
            operator.setRealName("操作员A");
            operator.setRole("OPERATOR");
            operator.setWarehouseId(1L);
            operator.setEnabled(true);
            userRepository.save(operator);

            User viewer = new User();
            viewer.setUsername("viewer1");
            viewer.setPassword(defaultPassword);
            viewer.setRealName("查看员B");
            viewer.setRole("VIEWER");
            viewer.setWarehouseId(1L);
            viewer.setEnabled(true);
            userRepository.save(viewer);

            System.out.println("已初始化用户数据: admin/123456, operator1/123456, viewer1/123456");
        }
    }
}
