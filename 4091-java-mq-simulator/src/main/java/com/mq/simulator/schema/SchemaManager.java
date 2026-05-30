package com.mq.simulator.schema;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.avro.Schema;
import org.apache.avro.generic.GenericData;
import org.apache.avro.generic.GenericDatumReader;
import org.apache.avro.generic.GenericDatumWriter;
import org.apache.avro.generic.GenericRecord;
import org.apache.avro.io.DecoderFactory;
import org.apache.avro.io.EncoderFactory;
import org.apache.avro.io.JsonEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class SchemaManager {
    private static final Logger logger = LoggerFactory.getLogger(SchemaManager.class);

    private final Map<String, SchemaEntry> avroSchemas;
    private final Map<String, ProtobufSchemaEntry> protobufSchemas;
    private final ObjectMapper objectMapper;
    private final String schemasDir;

    public SchemaManager() {
        this("schemas");
    }

    public SchemaManager(String schemasDir) {
        this.avroSchemas = new ConcurrentHashMap<>();
        this.protobufSchemas = new ConcurrentHashMap<>();
        this.objectMapper = new ObjectMapper();
        this.schemasDir = schemasDir;

        File dir = new File(schemasDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        loadSchemasFromDisk();
    }

    private void loadSchemasFromDisk() {
        try {
            Path dir = Paths.get(schemasDir);
            if (!Files.exists(dir)) {
                return;
            }

            Files.list(dir).forEach(p -> {
                try {
                    String fileName = p.getFileName().toString();
                    if (fileName.endsWith(".avsc")) {
                        loadAvroSchema(p.toFile());
                    } else if (fileName.endsWith(".proto") || fileName.endsWith(".descriptor")) {
                        logger.info("Protobuf schema found: {} (manual registration required)", fileName);
                    }
                } catch (Exception e) {
                    logger.error("Failed to load schema from {}: {}", p, e.getMessage());
                }
            });
        } catch (IOException e) {
            logger.error("Failed to scan schemas directory: {}", e.getMessage());
        }
    }

    public SchemaEntry loadAvroSchema(File file) throws IOException {
        String content = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
        Schema.Parser parser = new Schema.Parser();
        Schema schema = parser.parse(content);

        SchemaEntry entry = new SchemaEntry();
        entry.setName(schema.getName());
        entry.setNamespace(schema.getNamespace());
        entry.setSchemaContent(content);
        entry.setSchema(schema);
        entry.setVersion("1.0");
        entry.setFilePath(file.getAbsolutePath());

        avroSchemas.put(schema.getFullName(), entry);
        logger.info("Avro schema loaded: {} (v{})", schema.getFullName(), entry.getVersion());
        return entry;
    }

    public SchemaEntry registerAvroSchema(String name, String namespace, String schemaJson) {
        Schema.Parser parser = new Schema.Parser();
        Schema schema = parser.parse(schemaJson);

        SchemaEntry entry = new SchemaEntry();
        entry.setName(name);
        entry.setNamespace(namespace);
        entry.setSchemaContent(schemaJson);
        entry.setSchema(schema);
        entry.setVersion("1.0");

        String fullName = namespace != null && !namespace.isEmpty() ? namespace + "." + name : name;
        avroSchemas.put(fullName, entry);

        saveSchemaToDisk(name + ".avsc", schemaJson);
        logger.info("Avro schema registered: {}", fullName);
        return entry;
    }

    public ProtobufSchemaEntry registerProtobufSchema(String name, String messageType, byte[] descriptor) {
        ProtobufSchemaEntry entry = new ProtobufSchemaEntry();
        entry.setName(name);
        entry.setMessageType(messageType);
        entry.setDescriptor(descriptor);
        entry.setVersion("1.0");

        protobufSchemas.put(name, entry);
        saveSchemaToDisk(name + ".descriptor", new String(descriptor, StandardCharsets.ISO_8859_1));
        logger.info("Protobuf schema registered: {}", name);
        return entry;
    }

    public SchemaEntry getAvroSchema(String fullName) {
        return avroSchemas.get(fullName);
    }

    public ProtobufSchemaEntry getProtobufSchema(String name) {
        return protobufSchemas.get(name);
    }

    public List<SchemaEntry> listAvroSchemas() {
        return new ArrayList<>(avroSchemas.values());
    }

    public List<ProtobufSchemaEntry> listProtobufSchemas() {
        return new ArrayList<>(protobufSchemas.values());
    }

    public byte[] serializeAvro(String schemaFullName, String jsonContent) throws Exception {
        SchemaEntry entry = avroSchemas.get(schemaFullName);
        if (entry == null) {
            throw new IllegalArgumentException("Avro schema not found: " + schemaFullName);
        }

        Schema schema = entry.getSchema();
        JsonNode jsonNode = objectMapper.readTree(jsonContent);
        GenericRecord record = jsonToGenericRecord(jsonNode, schema);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        GenericDatumWriter<GenericRecord> writer = new GenericDatumWriter<>(schema);
        org.apache.avro.io.Encoder encoder = EncoderFactory.get().binaryEncoder(baos, null);
        writer.write(record, encoder);
        encoder.flush();

        return baos.toByteArray();
    }

    public String deserializeAvro(String schemaFullName, byte[] data) throws Exception {
        SchemaEntry entry = avroSchemas.get(schemaFullName);
        if (entry == null) {
            throw new IllegalArgumentException("Avro schema not found: " + schemaFullName);
        }

        Schema schema = entry.getSchema();
        GenericDatumReader<GenericRecord> reader = new GenericDatumReader<>(schema);
        org.apache.avro.io.Decoder decoder = DecoderFactory.get().binaryDecoder(new ByteArrayInputStream(data), null);
        GenericRecord record = reader.read(null, decoder);

        return genericRecordToJson(record).toString();
    }

    public String avroToJson(String schemaFullName, byte[] data) throws Exception {
        SchemaEntry entry = avroSchemas.get(schemaFullName);
        if (entry == null) {
            throw new IllegalArgumentException("Avro schema not found: " + schemaFullName);
        }

        Schema schema = entry.getSchema();
        GenericDatumReader<GenericRecord> reader = new GenericDatumReader<>(schema);
        org.apache.avro.io.Decoder decoder = DecoderFactory.get().binaryDecoder(new ByteArrayInputStream(data), null);
        GenericRecord record = reader.read(null, decoder);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        JsonEncoder encoder = EncoderFactory.get().jsonEncoder(schema, baos);
        GenericDatumWriter<GenericRecord> writer = new GenericDatumWriter<>(schema);
        writer.write(record, encoder);
        encoder.flush();

        return baos.toString(StandardCharsets.UTF_8.name());
    }

    private GenericRecord jsonToGenericRecord(JsonNode jsonNode, Schema schema) {
        GenericRecord record = new GenericData.Record(schema);

        for (Schema.Field field : schema.getFields()) {
            String fieldName = field.name();
            if (jsonNode.has(fieldName)) {
                JsonNode valueNode = jsonNode.get(fieldName);
                Object value = convertJsonValue(valueNode, field.schema());
                record.put(fieldName, value);
            }
        }

        return record;
    }

    private Object convertJsonValue(JsonNode jsonNode, Schema schema) {
        Schema.Type type = schema.getType();

        if (type == Schema.Type.UNION) {
            for (Schema s : schema.getTypes()) {
                if (s.getType() != Schema.Type.NULL) {
                    return convertJsonValue(jsonNode, s);
                }
            }
            return null;
        }

        if (jsonNode.isNull()) {
            return null;
        }

        switch (type) {
            case STRING:
                return jsonNode.asText();
            case INT:
                return jsonNode.asInt();
            case LONG:
                return jsonNode.asLong();
            case FLOAT:
                return (float) jsonNode.asDouble();
            case DOUBLE:
                return jsonNode.asDouble();
            case BOOLEAN:
                return jsonNode.asBoolean();
            case ENUM:
                return new GenericData.EnumSymbol(schema, jsonNode.asText());
            case ARRAY:
                Schema elementSchema = schema.getElementType();
                List<Object> list = new ArrayList<>();
                for (JsonNode element : jsonNode) {
                    list.add(convertJsonValue(element, elementSchema));
                }
                return list;
            case MAP:
                Schema valueSchema = schema.getValueType();
                Map<String, Object> map = new HashMap<>();
                jsonNode.fields().forEachRemaining(entry ->
                        map.put(entry.getKey(), convertJsonValue(entry.getValue(), valueSchema))
                );
                return map;
            case RECORD:
                return jsonToGenericRecord(jsonNode, schema);
            default:
                return jsonNode.toString();
        }
    }

    private JsonNode genericRecordToJson(GenericRecord record) {
        ObjectNode node = objectMapper.createObjectNode();

        for (Schema.Field field : record.getSchema().getFields()) {
            String name = field.name();
            Object value = record.get(name);
            node.set(name, valueToJsonNode(value, field.schema()));
        }

        return node;
    }

    private JsonNode valueToJsonNode(Object value, Schema schema) {
        if (value == null) {
            return objectMapper.nullNode();
        }

        Schema.Type type = schema.getType();
        if (type == Schema.Type.UNION) {
            for (Schema s : schema.getTypes()) {
                if (s.getType() != Schema.Type.NULL) {
                    return valueToJsonNode(value, s);
                }
            }
            return objectMapper.nullNode();
        }

        switch (type) {
            case STRING:
                return objectMapper.valueToTree(value.toString());
            case INT:
            case LONG:
            case FLOAT:
            case DOUBLE:
                return objectMapper.valueToTree(value);
            case BOOLEAN:
                return objectMapper.valueToTree((Boolean) value);
            case ENUM:
                return objectMapper.valueToTree(value.toString());
            case ARRAY:
                ArrayNode arrayNode = objectMapper.createArrayNode();
                Schema elementSchema = schema.getElementType();
                for (Object element : (List<?>) value) {
                    arrayNode.add(valueToJsonNode(element, elementSchema));
                }
                return arrayNode;
            case MAP:
                ObjectNode objectNode = objectMapper.createObjectNode();
                Schema valueSchema = schema.getValueType();
                for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                    objectNode.set(entry.getKey().toString(),
                            valueToJsonNode(entry.getValue(), valueSchema));
                }
                return objectNode;
            case RECORD:
                return genericRecordToJson((GenericRecord) value);
            default:
                return objectMapper.valueToTree(value.toString());
        }
    }

    public String inferAvroSchemaFromJson(String jsonContent, String schemaName) throws IOException {
        JsonNode root = objectMapper.readTree(jsonContent);
        ObjectNode schemaNode = objectMapper.createObjectNode();

        schemaNode.put("type", "record");
        schemaNode.put("name", schemaName);
        schemaNode.put("namespace", "com.mq.simulator.avro");

        ArrayNode fieldsArray = objectMapper.createArrayNode();
        inferFields(root, fieldsArray);
        schemaNode.set("fields", fieldsArray);

        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(schemaNode);
    }

    private void inferFields(JsonNode node, ArrayNode fieldsArray) {
        if (!node.isObject()) {
            return;
        }

        node.fields().forEachRemaining(entry -> {
            String name = entry.getKey();
            JsonNode value = entry.getValue();

            ObjectNode fieldNode = objectMapper.createObjectNode();
            fieldNode.put("name", name);

            String avroType = inferAvroType(value);
            if (value.isNull() || avroType.contains("null")) {
                ArrayNode typeArray = objectMapper.createArrayNode();
                typeArray.add("null");
                if (!avroType.equals("null")) {
                    typeArray.add(avroType);
                } else {
                    typeArray.add("string");
                }
                fieldNode.set("type", typeArray);
            } else {
                fieldNode.put("type", avroType);
            }

            if (value.isObject()) {
                fieldNode.put("type", "record");
                fieldNode.put("name", capitalize(name) + "Record");
                ArrayNode nestedFields = objectMapper.createArrayNode();
                inferFields(value, nestedFields);
                fieldNode.set("fields", nestedFields);
            }

            fieldsArray.add(fieldNode);
        });
    }

    private String inferAvroType(JsonNode value) {
        if (value.isNull()) {
            return "null";
        } else if (value.isBoolean()) {
            return "boolean";
        } else if (value.isInt() || value.isShort()) {
            return "int";
        } else if (value.isLong()) {
            return "long";
        } else if (value.isFloat() || value.isDouble()) {
            return "double";
        } else if (value.isArray()) {
            return "array";
        } else if (value.isObject()) {
            return "record";
        } else {
            return "string";
        }
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) {
            return str;
        }
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }

    private void saveSchemaToDisk(String fileName, String content) {
        try {
            Path path = Paths.get(schemasDir, fileName);
            Files.write(path, content.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            logger.error("Failed to save schema to disk: {}", e.getMessage());
        }
    }

    public void deleteAvroSchema(String fullName) {
        SchemaEntry entry = avroSchemas.remove(fullName);
        if (entry != null && entry.getFilePath() != null) {
            try {
                Files.deleteIfExists(Paths.get(entry.getFilePath()));
            } catch (IOException e) {
                logger.warn("Failed to delete schema file: {}", e.getMessage());
            }
        }
    }

    public static class SchemaEntry {
        private String name;
        private String namespace;
        private String version;
        private String schemaContent;
        private transient Schema schema;
        private String filePath;
        private long createdAt;

        public SchemaEntry() {
            this.createdAt = System.currentTimeMillis();
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getNamespace() {
            return namespace;
        }

        public void setNamespace(String namespace) {
            this.namespace = namespace;
        }

        public String getFullName() {
            if (namespace != null && !namespace.isEmpty()) {
                return namespace + "." + name;
            }
            return name;
        }

        public String getVersion() {
            return version;
        }

        public void setVersion(String version) {
            this.version = version;
        }

        public String getSchemaContent() {
            return schemaContent;
        }

        public void setSchemaContent(String schemaContent) {
            this.schemaContent = schemaContent;
        }

        public Schema getSchema() {
            if (schema == null && schemaContent != null) {
                Schema.Parser parser = new Schema.Parser();
                schema = parser.parse(schemaContent);
            }
            return schema;
        }

        public void setSchema(Schema schema) {
            this.schema = schema;
        }

        public String getFilePath() {
            return filePath;
        }

        public void setFilePath(String filePath) {
            this.filePath = filePath;
        }

        public long getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(long createdAt) {
            this.createdAt = createdAt;
        }
    }

    public static class ProtobufSchemaEntry {
        private String name;
        private String messageType;
        private String version;
        private byte[] descriptor;
        private String filePath;
        private long createdAt;

        public ProtobufSchemaEntry() {
            this.createdAt = System.currentTimeMillis();
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getMessageType() {
            return messageType;
        }

        public void setMessageType(String messageType) {
            this.messageType = messageType;
        }

        public String getVersion() {
            return version;
        }

        public void setVersion(String version) {
            this.version = version;
        }

        public byte[] getDescriptor() {
            return descriptor;
        }

        public void setDescriptor(byte[] descriptor) {
            this.descriptor = descriptor;
        }

        public String getFilePath() {
            return filePath;
        }

        public void setFilePath(String filePath) {
            this.filePath = filePath;
        }

        public long getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(long createdAt) {
            this.createdAt = createdAt;
        }
    }
}
