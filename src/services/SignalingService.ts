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
    console.log(`[Signaling] Subscribe called for user: ${userId}`);
    this.listeners.add(onMessage);
    this.userId = userId;

    if (this.channel) {
      const state = this.channel.state;
      console.log(`[Signaling] Channel exists. State: ${state}`);
      if (state === 'closed' || state === 'errored') {
        console.log('[Signaling] Channel is closed or errored, removing and reconnecting...');
        await supabase.removeChannel(this.channel);
        this.channel = null;
      } else {
        return;
      }
    }

    console.log('[Signaling] Creating new global-signaling channel');
    // Use a shared channel for signaling but filter messages in the listener
    this.channel = supabase.channel('global-signaling', {
      config: {
        broadcast: { self: false },
      },
    });

    this.channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        const message = payload as SignalingMessage;
        // console.log(`[Signaling] Received message: ${message.type} from ${message.senderId} to ${message.receiverId}`);
        if (message.receiverId === this.userId) {
          console.log('[Signaling] Message matched user, notifying listeners');
          this.listeners.forEach(listener => listener(message));
        }
      })
      .subscribe((status) => {
        console.log(`[Signaling] Channel status changed: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('[Signaling] Successfully subscribed to global-signaling');
        }
      });
  }

  async unsubscribe(onMessage: (message: SignalingMessage) => void) {
    this.listeners.delete(onMessage);
    if (this.listeners.size === 0 && this.channel) {
      console.log('[Signaling] No more listeners, removing channel');
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  async sendSignal(receiverId: string, message: Omit<SignalingMessage, 'receiverId'>) {
    const payload = { ...message, receiverId };
    console.log(`[Signaling] Sending ${message.type} to ${receiverId}`);
    
    // Broadcast is ephemeral, so we try a few times to increase delivery success
    const send = async (chan: RealtimeChannel) => {
      for (let i = 0; i < 3; i++) {
        const resp = await chan.send({
          type: 'broadcast',
          event: 'signal',
          payload,
        });
        if (resp !== 'ok') {
            console.log(`[Signaling] Send attempt ${i+1} failed: ${resp}`);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };

    if (!this.channel || this.channel.state !== 'joined') {
      console.log('[Signaling] No active channel, creating temp channel for sending');
      const tempChannel = supabase.channel('global-signaling');
      tempChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await send(tempChannel);
          setTimeout(() => supabase.removeChannel(tempChannel), 2000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[Signaling] Temp channel error:', status);
        }
      });
    } else {
      await send(this.channel);
    }
  }
}

export const signalingService = new SignalingService();

