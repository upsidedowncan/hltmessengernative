import React, { PropsWithChildren } from 'react';
import { Host } from '@expo/ui/swift-ui';

export function HostWrapper({ children }: PropsWithChildren) {
  return <Host style={{ flex: 1 }}>{children}</Host>;
}
