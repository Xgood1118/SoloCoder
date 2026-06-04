package com.crm.lead;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
@MapperScan("com.crm.lead.mapper")
public class CrmLeadApplication {

    public static void main(String[] args) {
        SpringApplication.run(CrmLeadApplication.class, args);
    }
}
