package com.track;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = "com.track")
public class VisitTrackingApplication {

    public static void main(String[] args) {
        SpringApplication.run(VisitTrackingApplication.class, args);
    }
}
