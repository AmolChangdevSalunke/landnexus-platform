package com.landnexus.shared.notification;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Collects the configured channel adapters and tells the rest of the code which are usable. */
@Component
public class NotificationChannelRegistry {

    private final Map<NotificationChannel, NotificationChannelAdapter> adapters;

    public NotificationChannelRegistry(List<NotificationChannelAdapter> adapters) {
        this.adapters = adapters.stream().collect(Collectors.toMap(
                NotificationChannelAdapter::channel, Function.identity(), (first, second) -> first));
    }

    public Optional<NotificationChannelAdapter> enabled(NotificationChannel channel) {
        return Optional.ofNullable(adapters.get(channel)).filter(NotificationChannelAdapter::enabled);
    }

    public NotificationChannelAdapter require(NotificationChannel channel) {
        NotificationChannelAdapter adapter = adapters.get(channel);
        if (adapter == null) {
            throw new NotificationDeliveryException("No adapter registered for channel " + channel);
        }
        return adapter;
    }
}
