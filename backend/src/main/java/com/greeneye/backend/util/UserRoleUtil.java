package com.greeneye.backend.util;

import com.greeneye.backend.entity.User;

public final class UserRoleUtil {

    private UserRoleUtil() {
    }

    public static boolean isAdmin(User user) {
        if (user == null || user.getRole() == null) {
            return false;
        }
        return "ADMIN".equalsIgnoreCase(user.getRole().trim());
    }
}
