package com.etl.encoding;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class EncodingDetector {

    private static final Logger logger = LoggerFactory.getLogger(EncodingDetector.class);

    private static final String[] CANDIDATE_ENCODINGS = {"UTF-8", "GBK", "GB2312", "Latin-1"};

    public String detectEncoding(byte[] data) {
        for (String encoding : CANDIDATE_ENCODINGS) {
            if (tryDecode(data, encoding)) {
                return encoding;
            }
        }
        return "Latin-1";
    }

    public String detectEncoding(byte[] data, String configuredEncoding) {
        if (configuredEncoding != null && !configuredEncoding.isEmpty()) {
            String detected = detectEncoding(data);
            if (!detected.equalsIgnoreCase(configuredEncoding)) {
                logger.warn("Detected encoding {} differs from configured encoding {}, using configured encoding", detected, configuredEncoding);
            }
            return configuredEncoding;
        }
        return detectEncoding(data);
    }

    public List<String> detectEncodings(List<byte[]> dataList) {
        List<String> encodings = new ArrayList<>(dataList.size());
        for (byte[] data : dataList) {
            encodings.add(detectEncoding(data));
        }
        return encodings;
    }

    private boolean tryDecode(byte[] data, String encoding) {
        if ("UTF-8".equals(encoding)) {
            return tryDecodeUtf8(data);
        }
        if ("GBK".equals(encoding) || "GB2312".equals(encoding)) {
            return tryDecodeWithReplacementCheck(data, encoding);
        }
        if ("Latin-1".equals(encoding)) {
            return true;
        }
        return tryDecodeWithReplacementCheck(data, encoding);
    }

    private boolean tryDecodeUtf8(byte[] data) {
        try {
            CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            decoder.decode(ByteBuffer.wrap(data));
            return true;
        } catch (CharacterCodingException e) {
            return false;
        }
    }

    private boolean tryDecodeWithReplacementCheck(byte[] data, String encoding) {
        try {
            Charset charset = Charset.forName(encoding);
            String decoded = new String(data, charset);
            return !decoded.contains("\uFFFD");
        } catch (Exception e) {
            return false;
        }
    }
}
