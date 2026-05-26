package com.cacheproxy.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.concurrent.TimeUnit;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Cache {

    String prefix() default "";

    String key() default "";

    long l1Ttl() default 300;

    long l2Ttl() default 3600;

    TimeUnit timeUnit() default TimeUnit.SECONDS;

    boolean enablePenetrationProtect() default true;

    int penetrationProtectThreshold() default 3;

}
