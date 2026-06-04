package com.oauth2.server.service;

import com.baomidou.mybatisplus.core.toolkit.PluginUtils;
import com.baomidou.mybatisplus.extension.plugins.inner.InnerInterceptor;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.entity.SysDataPermission;
import com.oauth2.server.mapper.SysDataPermissionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.sf.jsqlparser.JSQLParserException;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.operators.conditional.AndExpression;
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.schema.Column;
import net.sf.jsqlparser.statement.select.PlainSelect;
import net.sf.jsqlparser.statement.select.Select;
import net.sf.jsqlparser.statement.select.SelectItem;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.RowBounds;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataPermissionService implements InnerInterceptor {

    private final SysDataPermissionMapper sysDataPermissionMapper;
    private final ThreadLocal<LoginUserDTO> currentUser = new ThreadLocal<>();

    private static final String DATA_SCOPE_ALL = "1";
    private static final String DATA_SCOPE_CUSTOM = "2";
    private static final String DATA_SCOPE_DEPT = "3";
    private static final String DATA_SCOPE_DEPT_AND_CHILD = "4";
    private static final String DATA_SCOPE_SELF = "5";

    private final Map<String, List<SysDataPermission>> dataPermissionCache = new ConcurrentHashMap<>();

    public void setCurrentUser(LoginUserDTO user) {
        currentUser.set(user);
    }

    public void clearCurrentUser() {
        currentUser.remove();
    }

    public List<SysDataPermission> getDataPermissionsForCurrentUser() {
        LoginUserDTO user = currentUser.get();
        if (user == null || user.getUserId() == 0L) {
            return Collections.emptyList();
        }
        return sysDataPermissionMapper.selectByUserId(user.getUserId());
    }

    public String getRowCondition(String tableName) {
        LoginUserDTO user = currentUser.get();
        if (user == null || user.getUserId() == 0L) {
            return null;
        }

        List<SysDataPermission> permissions = getDataPermissionsForCurrentUser();
        if (permissions.isEmpty()) {
            return null;
        }

        Set<String> dataScopes = permissions.stream()
                .filter(p -> tableName.equals(p.getTableName()))
                .map(SysDataPermission::getRowCondition)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (dataScopes.isEmpty()) {
            return null;
        }

        List<String> conditions = new ArrayList<>();
        for (String scope : dataScopes) {
            switch (scope) {
                case DATA_SCOPE_ALL -> {
                    return null;
                }
                case DATA_SCOPE_CUSTOM -> {
                    String customCondition = buildCustomCondition(tableName, permissions);
                    if (customCondition != null) {
                        conditions.add(customCondition);
                    }
                }
                case DATA_SCOPE_DEPT -> {
                    if (user.getDeptId() != null) {
                        conditions.add("dept_id = " + user.getDeptId());
                    }
                }
                case DATA_SCOPE_DEPT_AND_CHILD -> {
                    if (user.getDeptId() != null) {
                        conditions.add("dept_id IN (SELECT id FROM sys_dept WHERE id = " + user.getDeptId() + " OR find_in_set(" + user.getDeptId() + ", ancestors))");
                    }
                }
                case DATA_SCOPE_SELF -> {
                    conditions.add("create_by = " + user.getUserId());
                }
                default -> conditions.add(scope);
            }
        }

        return conditions.isEmpty() ? null : String.join(" OR ", conditions);
    }

    private String buildCustomCondition(String tableName, List<SysDataPermission> permissions) {
        List<String> conditions = permissions.stream()
                .filter(p -> tableName.equals(p.getTableName()))
                .filter(p -> DATA_SCOPE_CUSTOM.equals(p.getRowCondition()))
                .map(SysDataPermission::getColumnPermission)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        return conditions.isEmpty() ? null : String.join(" OR ", conditions);
    }

    public Set<String> getAllowedColumns(String tableName) {
        LoginUserDTO user = currentUser.get();
        if (user == null || user.getUserId() == 0L) {
            return null;
        }

        List<SysDataPermission> permissions = getDataPermissionsForCurrentUser();
        Set<String> allowedColumns = permissions.stream()
                .filter(p -> tableName.equals(p.getTableName()))
                .filter(p -> p.getColumnName() != null && !p.getColumnName().isEmpty())
                .map(SysDataPermission::getColumnName)
                .collect(Collectors.toSet());

        return allowedColumns.isEmpty() ? null : allowedColumns;
    }

    @Override
    public void beforeQuery(Executor executor, MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
        LoginUserDTO user = currentUser.get();
        if (user == null || user.getUserId() == 0L) {
            return;
        }

        try {
            String originalSql = boundSql.getSql();
            Select select = (Select) CCJSqlParserUtil.parse(originalSql);

            if (select.getSelectBody() instanceof PlainSelect plainSelect) {
                applyRowLevelPermission(plainSelect, user);
                applyColumnLevelPermission(plainSelect, user);
                PluginUtils.MPBoundSql mpBs = PluginUtils.mpBoundSql(boundSql);
                mpBs.sql(plainSelect.toString());
            }
        } catch (JSQLParserException e) {
            log.error("Data permission parsing error: {}", e.getMessage());
        }
    }

    private void applyRowLevelPermission(PlainSelect plainSelect, LoginUserDTO user) {
        String tableName = plainSelect.getFromItem().toString().replace("`", "");
        String rowCondition = getRowCondition(tableName);

        if (rowCondition != null && !rowCondition.isEmpty()) {
            try {
                Expression condition = CCJSqlParserUtil.parseCondExpression(rowCondition);
                Expression where = plainSelect.getWhere();
                if (where == null) {
                    plainSelect.setWhere(condition);
                } else {
                    plainSelect.setWhere(new AndExpression(where, condition));
                }
            } catch (JSQLParserException e) {
                log.error("Row level permission expression error: {}", e.getMessage());
            }
        }
    }

    private void applyColumnLevelPermission(PlainSelect plainSelect, LoginUserDTO user) {
        String tableName = plainSelect.getFromItem().toString().replace("`", "");
        Set<String> allowedColumns = getAllowedColumns(tableName);

        if (allowedColumns != null && !allowedColumns.isEmpty()) {
            List<SelectItem<?>> newItems = new ArrayList<>();
            for (String col : allowedColumns) {
                SelectItem<Column> item = new SelectItem<>(new Column(col));
                newItems.add(item);
            }
            if (!newItems.isEmpty()) {
                plainSelect.setSelectItems(newItems);
            }
        }
    }

    public boolean hasDataPermission(Long userId, String tableName, String operation) {
        List<SysDataPermission> permissions = sysDataPermissionMapper.selectByUserId(userId);
        return permissions.stream()
                .anyMatch(p -> tableName.equals(p.getTableName()) && p.getStatus() == 1);
    }

    public void clearCache() {
        dataPermissionCache.clear();
    }
}
