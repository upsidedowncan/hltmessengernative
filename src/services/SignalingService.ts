import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type SignalingMessage = {
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'reject' | 'incoming-call' | 'peer-ready';
  senderId: string;
  senderName?: string;
  receiverId: string;
  data?: any;
};

class SignalingService {
  private channel: RealtimeChannel | null = null;
  private listeners: Set<(message: SignalingMessage) => void> = new Set();
  private userId: string | null = null;

  async subscribe(userId: string, onMessage: (message: SignalingMessage) => void) {
    this.listeners.add(onMessage);
    this.userId = userId;

    if (this.channel) return;

    // Use a shared channel for signaling but filter messages in the listener
    this.channel = supabase.channel('global-signaling', {
      config: {
        broadcast: { self: false },
      },
    });

    this.channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        const message = payload as SignalingMessage;
        if (message.receiverId === this.userId) {
          this.listeners.forEach(listener => listener(message));
        }
      })
      .subscribe();
  }

  async unsubscribe(onMessage: (message: SignalingMessage) => void) {
    this.listeners.delete(onMessage);
    if (this.listeners.size === 0 && this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  async sendSignal(receiverId: string, message: Omit<SignalingMessage, 'receiverId'>) {
    const payload = { ...message, receiverId };
    
    // Broadcast is ephemeral, so we try a few times to increase delivery success
    const send = async (chan: RealtimeChannel) => {
      for (let i = 0; i < 3; i++) {
        await chan.send({
          type: 'broadcast',
          event: 'signal',
          payload,
        });
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };

    if (!this.channel) {
      const tempChannel = supabase.channel('global-signaling');
      tempChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await send(tempChannel);
          setTimeout(() => supabase.removeChannel(tempChannel), 2000);
        }
      });
    } else {
      await send(this.channel);
    }
  }
}

export const signalingService = new SignalingService();
