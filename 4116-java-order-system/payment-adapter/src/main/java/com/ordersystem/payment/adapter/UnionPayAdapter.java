package com.ordersystem.payment.adapter;

import com.ordersystem.payment.config.PaymentConfig;
import com.ordersystem.payment.model.PaymentCallback;
import com.ordersystem.payment.model.PaymentChannel;
import com.ordersystem.payment.model.PaymentCreateRequest;
import com.ordersystem.payment.model.PaymentCreateResult;
import com.ordersystem.payment.model.PaymentOrder;
import com.ordersystem.payment.model.PaymentStatus;
import com.ordersystem.payment.repository.PaymentOrderRepository;
import cn.hutool.crypto.SecureUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class UnionPayAdapter implements PaymentAdapter {

    private final PaymentConfig paymentConfig;
    private final PaymentOrderRepository paymentOrderRepository;

    @Override
    public PaymentCreateResult createPayment(PaymentCreateRequest request) {
        PaymentConfig.ChannelConfig config = paymentConfig.getChannels().get("unionpay");
        String outTradeNo = "UN_" + IdUtil.fastSimpleUUID();
        String sign = sign(outTradeNo, request.getAmount(), config.getSecret());

        String payUrl = String.format("%s?appId=%s&outTradeNo=%s&subject=%s&totalAmount=%s&sign=%s",
                config.getGatewayUrl(), config.getAppId(), outTradeNo,
                request.getSubject(), request.getAmount().toPlainString(), sign);

        PaymentCreateResult result = new PaymentCreateResult();
        result.setPaymentId(outTradeNo);
        result.setPayUrl(payUrl);
        result.setChannel(PaymentChannel.UNIONPAY);
        return result;
    }

    @Override
    public PaymentOrder queryPayment(String paymentId) {
        PaymentConfig.ChannelConfig config = paymentConfig.getChannels().get("unionpay");
        String sign = sign(paymentId, null, config.getSecret());

        PaymentOrder order = paymentOrderRepository.findByPaymentId(paymentId);
        if (order != null && order.getStatus() == PaymentStatus.PAYING) {
            log.info("UnionPay query payment: paymentId={}, sign={}", paymentId, sign);
        }
        return order;
    }

    @Override
    public PaymentCallback handleCallback(Map<String, String> params, PaymentChannel channel) {
        PaymentConfig.ChannelConfig config = paymentConfig.getChannels().get("unionpay");
        boolean verified = verifySign(params, config.getSecret());
        if (!verified) {
            throw new RuntimeException("UnionPay callback sign verification failed");
        }

        PaymentCallback callback = new PaymentCallback();
        callback.setPaymentId(params.get("orderId"));
        callback.setOrderNo(params.get("orderNo"));
        callback.setChannel(PaymentChannel.UNIONPAY);
        callback.setCallbackNo(params.get("queryId"));
        callback.setCallbackTime(LocalDateTime.now());

        String respCode = params.get("respCode");
        if ("00".equals(respCode)) {
            callback.setStatus(PaymentStatus.SUCCESS);
        } else {
            callback.setStatus(PaymentStatus.FAILED);
        }

        if (params.get("txnAmt") != null) {
            callback.setAmount(new BigDecimal(params.get("txnAmt")).divide(new BigDecimal("100")));
        }
        callback.setRawParams(params);
        return callback;
    }

    @Override
    public boolean refund(String paymentId, BigDecimal amount) {
        PaymentConfig.ChannelConfig config = paymentConfig.getChannels().get("unionpay");
        String sign = sign(paymentId, amount, config.getSecret());
        log.info("UnionPay refund: paymentId={}, amount={}, sign={}", paymentId, amount, sign);
        return true;
    }

    @Override
    public boolean closePayment(String paymentId) {
        PaymentConfig.ChannelConfig config = paymentConfig.getChannels().get("unionpay");
        String sign = sign(paymentId, null, config.getSecret());
        log.info("UnionPay close payment: paymentId={}, sign={}", paymentId, sign);
        return true;
    }

    private String sign(String outTradeNo, BigDecimal amount, String secret) {
        String content = outTradeNo;
        if (amount != null) {
            content = outTradeNo + amount.toPlainString();
        }
        return SecureUtil.sha256(content + secret);
    }

    private boolean verifySign(Map<String, String> params, String secret) {
        String sign = params.remove("sign");
        if (StrUtil.isBlank(sign)) {
            return false;
        }
        String content = params.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&"));
        String expected = SecureUtil.sha256(content + secret);
        return sign.equals(expected);
    }
}
