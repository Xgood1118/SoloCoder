package com.track.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FingerprintRequest {

    private String userAgent;

    private String screenResolution;

    private String timezone;

    private String language;

    private String installedFonts;
}
