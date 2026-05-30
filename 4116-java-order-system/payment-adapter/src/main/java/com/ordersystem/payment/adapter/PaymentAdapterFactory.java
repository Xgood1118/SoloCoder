package com.ordersystem.payment.adapter;

import com.ordersystem.payment.model.PaymentChannel;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.Map;

@Component
public class PaymentAdapterFactory {

    private final Map<PaymentChannel, PaymentAdapter> adapterMap;

    public PaymentAdapterFactory(AlipayAdapter alipayAdapter,
                                  WechatPayAdapter wechatPayAdapter,
                                  UnionPayAdapter unionPayAdapter) {
        adapterMap = new EnumMap<>(PaymentChannel.class);
        adapterMap.put(PaymentChannel.ALIPAY, alipayAdapter);
        adapterMap.put(PaymentChannel.WECHAT, wechatPayAdapter);
        adapterMap.put(PaymentChannel.UNIONPAY, unionPayAdapter);
    }

    public PaymentAdapter getAdapter(PaymentChannel channel) {
        PaymentAdapter adapter = adapterMap.get(channel);
        if (adapter == null) {
            throw new IllegalArgumentException("Unsupported payment channel: " + channel);
        }
        return adapter;
    }
}
