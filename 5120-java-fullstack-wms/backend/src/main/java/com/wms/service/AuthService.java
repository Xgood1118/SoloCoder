package com.wms.service;

import com.wms.dto.LoginRequest;
import com.wms.dto.LoginResponse;
import com.wms.entity.User;
import com.wms.repository.UserRepository;
import com.wms.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("用户名或密码错误"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("用户名或密码错误");
        }

        if (!user.getEnabled()) {
            throw new RuntimeException("账号已被禁用");
        }

        String token = jwtUtil.generateToken(
                user.getUsername(),
                user.getId(),
                user.getRole(),
                user.getWarehouseId()
        );

        return new LoginResponse(
                token,
                user.getUsername(),
                user.getRealName(),
                user.getRole(),
                user.getWarehouseId()
        );
    }
}
