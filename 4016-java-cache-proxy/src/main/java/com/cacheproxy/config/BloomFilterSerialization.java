package com.cacheproxy.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class BloomFilterSerialization {

    public static class BloomFilterSerializer extends JsonSerializer<BloomFilter> {
        @Override
        public void serialize(BloomFilter value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            value.writeTo(baos);
            String encoded = Base64.getEncoder().encodeToString(baos.toByteArray());
            gen.writeString(encoded);
        }
    }

    public static class BloomFilterDeserializer extends JsonDeserializer<BloomFilter> {
        @Override
        public BloomFilter deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            String encoded = p.getValueAsString();
            byte[] bytes = Base64.getDecoder().decode(encoded);
            ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
            return BloomFilter.readFrom(bais, Funnels.stringFunnel(StandardCharsets.UTF_8));
        }
    }
}
