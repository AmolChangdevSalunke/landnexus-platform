package com.landnexus.shared.openapi;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.lang.reflect.Method;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.MethodParameter;
import org.springframework.core.ResolvableType;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ValueConstants;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * An OpenAPI 3.0 document built from the RUNNING code: every controller method, its HTTP method and path, the permission
 * from @PreAuthorize, path/query/body parameters and the shapes of the DTO records. It has no examples and no Swagger UI
 * (no extra dependency); save the JSON with scripts/export-openapi.ps1 and open it in any OpenAPI viewer or Postman.
 */
@Service
public class OpenApiService {

    private static final Pattern PERMISSION = Pattern.compile("hasAuthority\\('([A-Za-z_]+)'\\)");
    private static final Set<String> PUBLIC_PATHS = Set.of("/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/reset-password");
    private static final DefaultParameterNameDiscoverer NAMES = new DefaultParameterNameDiscoverer();

    private final RequestMappingHandlerMapping mapping;

    public OpenApiService(@Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mapping) {
        this.mapping = mapping;
    }

    public Map<String, Object> document() {
        Map<String, Object> schemas = new TreeMap<>();
        Map<String, Class<?>> owners = new HashMap<>();
        Map<String, Map<String, Object>> paths = new TreeMap<>();
        Set<String> tags = new TreeSet<>();
        schemas.put("ApiError", Map.of("type", "object", "properties", Map.of("timestamp", Map.of("type", "string"),
                "status", Map.of("type", "integer"), "error", Map.of("type", "string"), "message", Map.of("type", "string"),
                "path", Map.of("type", "string"), "fieldErrors", Map.of("type", "array", "items", Map.of("type", "object")))));

        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : mapping.getHandlerMethods().entrySet()) {
            HandlerMethod handler = entry.getValue();
            Class<?> bean = handler.getBeanType();
            if (!bean.getName().startsWith("com.landnexus.") || !AnnotatedElementUtils.hasAnnotation(bean, RestController.class)
                    || entry.getKey().getPathPatternsCondition() == null) {
                continue;
            }
            Set<RequestMethod> methods = entry.getKey().getMethodsCondition().getMethods();
            for (String pattern : entry.getKey().getPathPatternsCondition().getPatternValues()) {
                for (RequestMethod method : methods.isEmpty() ? EnumSet.of(RequestMethod.GET) : methods) {
                    paths.computeIfAbsent(pattern, k -> new TreeMap<>())
                            .put(method.name().toLowerCase(Locale.ROOT), operation(handler, bean, pattern, schemas, owners));
                    tags.add(tagOf(bean));
                }
            }
        }
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("openapi", "3.0.3");
        document.put("info", Map.of("title", "LandNexus API", "version", "1.0.0", "description",
                "Generated from the running code: paths, methods, required permissions (x-required-permission) and DTO shapes. "
                        + "No examples. Every endpoint except those marked public needs a Bearer access token."));
        document.put("servers", List.of(Map.of("url", "http://localhost:8080")));
        document.put("tags", tags.stream().map(t -> Map.of("name", t)).toList());
        document.put("paths", new TreeMap<String, Object>(paths));
        document.put("components", Map.of("schemas", schemas,
                "securitySchemes", Map.of("bearerAuth", Map.of("type", "http", "scheme", "bearer", "bearerFormat", "JWT"))));
        document.put("security", List.of(Map.of("bearerAuth", List.of())));
        return document;
    }

    private Map<String, Object> operation(HandlerMethod handler, Class<?> bean, String path, Map<String, Object> schemas,
                                          Map<String, Class<?>> owners) {
        Method method = handler.getMethod();
        Map<String, Object> op = new LinkedHashMap<>();
        op.put("tags", List.of(tagOf(bean)));
        op.put("operationId", bean.getSimpleName() + "_" + method.getName());
        op.put("summary", humanize(method.getName()));
        boolean isPublic = PUBLIC_PATHS.contains(path);
        String permission = permissionOf(method, bean);
        op.put("x-required-permission", isPublic ? "public" : permission == null ? "authenticated" : permission);
        if (isPublic) {
            op.put("security", List.of());
        }

        boolean hasPart = Arrays.stream(handler.getMethodParameters()).anyMatch(mp -> mp.hasParameterAnnotation(RequestPart.class));
        List<Map<String, Object>> parameters = new ArrayList<>();
        Map<String, Object> formProperties = new LinkedHashMap<>();
        List<String> formRequired = new ArrayList<>();
        Map<String, Object> bodySchema = null;
        boolean bodyRequired = false;
        for (MethodParameter mp : handler.getMethodParameters()) {
            mp.initParameterNameDiscovery(NAMES);
            ResolvableType type = ResolvableType.forMethodParameter(mp);
            PathVariable pathVariable = mp.getParameterAnnotation(PathVariable.class);
            RequestParam requestParam = mp.getParameterAnnotation(RequestParam.class);
            RequestPart requestPart = mp.getParameterAnnotation(RequestPart.class);
            RequestBody requestBody = mp.getParameterAnnotation(RequestBody.class);
            if (pathVariable != null) {
                parameters.add(parameter(nameOf(pathVariable.name(), pathVariable.value(), mp), "path", true, schema(type, schemas, owners, 0)));
            } else if (requestParam != null) {
                String name = nameOf(requestParam.name(), requestParam.value(), mp);
                boolean required = requestParam.required() && ValueConstants.DEFAULT_NONE.equals(requestParam.defaultValue());
                if (hasPart) {
                    formProperties.put(name, schema(type, schemas, owners, 0));
                    if (required) {
                        formRequired.add(name);
                    }
                } else {
                    parameters.add(parameter(name, "query", required, schema(type, schemas, owners, 0)));
                }
            } else if (requestPart != null) {
                String name = nameOf(requestPart.name(), requestPart.value(), mp);
                formProperties.put(name, Map.of("type", "string", "format", "binary"));
                formRequired.add(name);
            } else if (requestBody != null) {
                bodySchema = schema(type, schemas, owners, 0);
                bodyRequired = requestBody.required();
            }
        }
        if (!parameters.isEmpty()) {
            op.put("parameters", parameters);
        }
        if (hasPart) {
            Map<String, Object> form = new LinkedHashMap<>();
            form.put("type", "object");
            form.put("properties", formProperties);
            if (!formRequired.isEmpty()) {
                form.put("required", formRequired);
            }
            op.put("requestBody", Map.of("required", true, "content", Map.of("multipart/form-data", Map.of("schema", form))));
        } else if (bodySchema != null) {
            op.put("requestBody", Map.of("required", bodyRequired, "content", Map.of("application/json", Map.of("schema", bodySchema))));
        }
        op.put("responses", responses(method, schemas, owners));
        return op;
    }

    private Map<String, Object> responses(Method method, Map<String, Object> schemas, Map<String, Class<?>> owners) {
        ResponseStatus status = AnnotatedElementUtils.findMergedAnnotation(method, ResponseStatus.class);
        HttpStatus ok = status != null ? status.code() : HttpStatus.OK;
        ResolvableType returned = ResolvableType.forMethodReturnType(method);
        boolean wrapped = returned.resolve(Object.class) == ResponseEntity.class;
        ResolvableType inner = wrapped ? returned.getGeneric(0) : returned;
        Class<?> raw = inner.resolve(Object.class);

        Map<String, Object> success = new LinkedHashMap<>();
        success.put("description", ok.getReasonPhrase());
        if (raw != void.class && raw != Void.class && ok != HttpStatus.NO_CONTENT) {
            if (raw == byte[].class || Resource.class.isAssignableFrom(raw)) {
                success.put("content", Map.of("application/octet-stream", Map.of("schema", Map.of("type", "string", "format", "binary"))));
            } else if (wrapped && raw == String.class) {
                success.put("content", Map.of("application/json", Map.of("schema", Map.of("type", "object", "description", "A JSON document (for example GeoJSON)"))));
            } else {
                success.put("content", Map.of("application/json", Map.of("schema", schema(inner, schemas, owners, 0))));
            }
        }
        Map<String, Object> responses = new LinkedHashMap<>();
        responses.put(String.valueOf(ok.value()), success);
        Map<String, Object> error = Map.of("$ref", "#/components/schemas/ApiError");
        for (String code : List.of("400", "401", "403", "404")) {
            responses.put(code, Map.of("description", "Error", "content", Map.of("application/json", Map.of("schema", error))));
        }
        return responses;
    }

    private Map<String, Object> schema(ResolvableType type, Map<String, Object> schemas, Map<String, Class<?>> owners, int depth) {
        Class<?> raw = type.resolve(Object.class);
        if (depth > 8) {
            return Map.of("type", "object");
        }
        if (raw == ResponseEntity.class || raw == Optional.class) {
            return schema(type.getGeneric(0), schemas, owners, depth + 1);
        }
        if (CharSequence.class.isAssignableFrom(raw)) {
            return Map.of("type", "string");
        }
        if (raw == UUID.class) {
            return Map.of("type", "string", "format", "uuid");
        }
        if (raw == LocalDate.class) {
            return Map.of("type", "string", "format", "date");
        }
        if (raw == Instant.class || raw == OffsetDateTime.class || raw == ZonedDateTime.class || raw == LocalDateTime.class) {
            return Map.of("type", "string", "format", "date-time");
        }
        if (raw == BigDecimal.class || raw == double.class || raw == Double.class || raw == float.class || raw == Float.class) {
            return Map.of("type", "number");
        }
        if (raw == long.class || raw == Long.class) {
            return Map.of("type", "integer", "format", "int64");
        }
        if (raw == int.class || raw == Integer.class || raw == short.class || raw == Short.class || raw == byte.class || raw == Byte.class) {
            return Map.of("type", "integer");
        }
        if (raw == boolean.class || raw == Boolean.class) {
            return Map.of("type", "boolean");
        }
        if (raw == byte[].class || Resource.class.isAssignableFrom(raw) || MultipartFile.class.isAssignableFrom(raw)) {
            return Map.of("type", "string", "format", "binary");
        }
        if (raw.isEnum()) {
            return Map.of("type", "string", "enum", Arrays.stream(raw.getEnumConstants()).map(Object::toString).toList());
        }
        if (raw.isArray()) {
            return Map.of("type", "array", "items", schema(ResolvableType.forClass(raw.getComponentType()), schemas, owners, depth + 1));
        }
        if (Collection.class.isAssignableFrom(raw)) {
            return Map.of("type", "array", "items", schema(type.asCollection().getGeneric(0), schemas, owners, depth + 1));
        }
        if (Map.class.isAssignableFrom(raw)) {
            return Map.of("type", "object", "additionalProperties", schema(type.asMap().getGeneric(1), schemas, owners, depth + 1));
        }
        if (raw.isRecord()) {
            return Map.of("$ref", "#/components/schemas/" + recordSchema(type, raw, schemas, owners, depth));
        }
        return Map.of("type", "object");
    }

    private String recordSchema(ResolvableType type, Class<?> raw, Map<String, Object> schemas, Map<String, Class<?>> owners, int depth) {
        StringBuilder name = new StringBuilder(raw.getSimpleName());
        for (ResolvableType generic : type.getGenerics()) {
            name.append('_').append(generic.resolve(Object.class).getSimpleName());
        }
        String key = name.toString();
        if (owners.containsKey(key) && owners.get(key) != raw && raw.getEnclosingClass() != null) {
            key = raw.getEnclosingClass().getSimpleName() + "." + key;
        }
        if (!schemas.containsKey(key)) {
            owners.put(key, raw);
            Map<String, Object> holder = new LinkedHashMap<>();
            schemas.put(key, holder);
            Map<String, Object> properties = new LinkedHashMap<>();
            List<String> required = new ArrayList<>();
            for (RecordComponent component : raw.getRecordComponents()) {
                Map<String, Object> property = new LinkedHashMap<>(schema(ResolvableType.forType(component.getGenericType(), type), schemas, owners, depth + 1));
                Method accessor = component.getAccessor();
                if (accessor.isAnnotationPresent(NotNull.class) || accessor.isAnnotationPresent(NotBlank.class) || accessor.isAnnotationPresent(NotEmpty.class)) {
                    required.add(component.getName());
                }
                Size size = accessor.getAnnotation(Size.class);
                if (size != null && "string".equals(property.get("type")) && size.max() < Integer.MAX_VALUE) {
                    property.put("maxLength", size.max());
                }
                properties.put(component.getName(), property);
            }
            holder.put("type", "object");
            holder.put("properties", properties);
            if (!required.isEmpty()) {
                holder.put("required", required);
            }
        }
        return key;
    }

    private static Map<String, Object> parameter(String name, String in, boolean required, Map<String, Object> schema) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("name", name);
        p.put("in", in);
        p.put("required", required);
        p.put("schema", schema);
        return p;
    }

    private static String nameOf(String name, String value, MethodParameter parameter) {
        if (name != null && !name.isEmpty()) {
            return name;
        }
        if (value != null && !value.isEmpty()) {
            return value;
        }
        return parameter.getParameterName() == null ? "arg" + parameter.getParameterIndex() : parameter.getParameterName();
    }

    private static String permissionOf(Method method, Class<?> bean) {
        PreAuthorize annotation = AnnotatedElementUtils.findMergedAnnotation(method, PreAuthorize.class);
        if (annotation == null) {
            annotation = AnnotatedElementUtils.findMergedAnnotation(bean, PreAuthorize.class);
        }
        if (annotation == null) {
            return null;
        }
        Matcher m = PERMISSION.matcher(annotation.value());
        return m.find() ? m.group(1) : annotation.value();
    }

    private static String tagOf(Class<?> bean) {
        return bean.getSimpleName().replaceAll("Controller$", "");
    }

    private static String humanize(String methodName) {
        String spaced = methodName.replaceAll("([a-z0-9])([A-Z])", "$1 $2");
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }
}