package com.crm.lead.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult<T> implements Serializable {

    private Long total;

    private List<T> list;

    private Integer pageNum;

    private Integer pageSize;

    public static <T> PageResult<T> of(long total, List<T> list, int pageNum, int pageSize) {
        return new PageResult<>(total, list, pageNum, pageSize);
    }
}
