package com.cacheproxy.demo;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public User getUserById(@PathVariable Long id) {
        return userService.getUserById(id);
    }

    @GetMapping("/search")
    public User getUserByNameAndEmail(@RequestParam String name, @RequestParam String email) {
        return userService.getUserByNameAndEmail(name, email);
    }

    @PutMapping
    public User updateUser(@RequestBody User user) {
        return userService.updateUser(user);
    }

    @DeleteMapping("/clear")
    public String clearAll() {
        userService.clearAllUsers();
        return "All user caches cleared";
    }

    @GetMapping("/expensive/{id}")
    public String getExpensiveData(@PathVariable Long id) {
        return userService.getExpensiveData(id);
    }
}
