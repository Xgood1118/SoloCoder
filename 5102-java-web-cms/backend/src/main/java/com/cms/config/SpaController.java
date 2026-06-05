package com.cms.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaController {

    @RequestMapping(value = {"/", "/login", "/documents/**", "/categories/**",
            "/tags/**", "/search/**", "/reviews/**", "/templates/**",
            "/review-configs/**", "/profile/**"})
    public String forward() {
        return "forward:/index.html";
    }
}
