import { signalingService, SignalingMessage } from './SignalingService';
import { Platform } from 'react-native';

let RTCPeerConnection: any;
let RTCIceCandidate: any;
let RTCSessionDescription: any;
let mediaDevices: any;

try {
  const WebRTC = require('react-native-webrtc');
  RTCPeerConnection = WebRTC.RTCPeerConnection;
  RTCIceCandidate = WebRTC.RTCIceCandidate;
  RTCSessionDescription = WebRTC.RTCSessionDescription;
  mediaDevices = WebRTC.mediaDevices;
} catch (e) {
  console.log('WebRTC not supported in this environment');
}

class CallService {
  private pc: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private userId: string | null = null;
  private friendId: string | null = null;

  private onRemoteStreamCallback: ((stream: any) => void) | null = null;
  private onCallEndCallback: (() => void) | null = null;
  private messageHandler: ((message: SignalingMessage) => void) | null = null;
  private pendingOffer: any = null;

  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  public isSupported() {
    return !!RTCPeerConnection && !!mediaDevices;
  }

  async setup(userId: string) {
    if (!this.isSupported()) return;
    this.userId = userId;
    this.messageHandler = this.handleSignalingMessage.bind(this);
    await signalingService.subscribe(userId, this.messageHandler);
  }

  setCallbacks(onRemoteStream: (stream: any) => void, onCallEnd: () => void) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onCallEndCallback = onCallEnd;
  }

  private async handleSignalingMessage(message: SignalingMessage) {
    switch (message.type) {
      case 'offer':
        this.friendId = message.senderId;
        this.pendingOffer = message.data;
        break;
      case 'answer':
        await this.handleAnswer(message.data);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(message.data);
        break;
      case 'hangup':
      case 'reject':
        this.endCall(false);
        break;
    }
  }

  private async createPeerConnection() {
    if (!this.isSupported()) return;
    this.pc = new RTCPeerConnection(this.configuration);

    this.pc.onicecandidate = (event: any) => {
      if (event.candidate && this.friendId) {
        signalingService.sendSignal(this.friendId, {
          type: 'ice-candidate',
          senderId: this.userId!,
          data: event.candidate,
        });
      }
    };

    this.pc.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => {
        this.pc!.addTrack(track, this.localStream!);
      });
    }
  }

  async startCall(friendId: string, senderName: string) {
    if (!this.isSupported()) return;
    this.friendId = friendId;
    
    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    await this.createPeerConnection();

    const offer = await this.pc!.createOffer({});
    await this.pc!.setLocalDescription(offer);

    await signalingService.sendSignal(friendId, {
      type: 'offer',
      senderId: this.userId!,
      senderName,
      data: offer,
    });
  }

  async acceptCall() {
    if (!this.isSupported() || !this.pendingOffer || !this.friendId) return;

    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    await this.createPeerConnection();

    await this.pc!.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);

    await signalingService.sendSignal(this.friendId, {
      type: 'answer',
      senderId: this.userId!,
      data: answer,
    });

    this.pendingOffer = null;
  }

  private async handleAnswer(answer: any) {
    if (this.pc && this.isSupported()) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private async handleIceCandidate(candidate: any) {
    if (this.pc && this.isSupported()) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  endCall(notifyFriend: boolean = true) {
    if (notifyFriend && this.friendId && this.userId) {
      signalingService.sendSignal(this.friendId, {
        type: 'hangup',
        senderId: this.userId,
      });
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => track.stop());
      this.localStream = null;
    }

    this.remoteStream = null;
    this.friendId = null;

    if (this.onCallEndCallback) {
      this.onCallEndCallback();
    }
  }
}

export const callService = new CallService();

