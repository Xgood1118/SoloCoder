package com.etl.encoding;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;

public class EncodingUtils {

    public static String decodeWithFallback(byte[] data, String primaryEncoding, String fallbackEncoding) {
        try {
            CharsetDecoder decoder = Charset.forName(primaryEncoding).newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            return decoder.decode(ByteBuffer.wrap(data)).toString();
        } catch (CharacterCodingException e) {
            return new String(data, Charset.forName(fallbackEncoding));
        }
    }

    public static String decodeWithReplacement(byte[] data, String encoding) {
        try {
            CharsetDecoder decoder = Charset.forName(encoding).newDecoder()
                    .onMalformedInput(CodingErrorAction.REPLACE)
                    .onUnmappableCharacter(CodingErrorAction.REPLACE);
            return decoder.decode(ByteBuffer.wrap(data)).toString();
        } catch (CharacterCodingException e) {
            return new String(data, Charset.forName(encoding));
        }
    }

    public static boolean isValidEncoding(byte[] data, String encoding) {
        try {
            CharsetDecoder decoder = Charset.forName(encoding).newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            decoder.decode(ByteBuffer.wrap(data));
            return true;
        } catch (CharacterCodingException e) {
            return false;
        }
    }
}
