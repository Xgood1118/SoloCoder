package com.audit.mask;

import com.audit.common.enums.MaskStrategy;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaskRule {

    private String fieldName;
    private MaskStrategy strategy;
    @Builder.Default
    private int keepPrefix = 0;
    @Builder.Default
    private int keepSuffix = 0;
    @Builder.Default
    private char replaceChar = '*';
    @Builder.Default
    private boolean enabled = true;
}
