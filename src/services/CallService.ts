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
  private onLocalStreamCallback: ((stream: any) => void) | null = null;
  private onCallEndCallback: (() => void) | null = null;
  private messageHandler: ((message: SignalingMessage) => void) | null = null;
  private pendingOffer: any = null;
  private pendingCandidates: any[] = [];
  private isRemoteDescriptionSet = false;

  // Volume Monitoring
  private volumeInterval: NodeJS.Timeout | null = null;
  private onVolumeChangeCallback: ((volume: number) => void) | null = null;

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

  setCallbacks(
      onRemoteStream: (stream: any) => void, 
      onCallEnd: () => void, 
      onLocalStream?: (stream: any) => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onCallEndCallback = onCallEnd;
    if (onLocalStream) {
        this.onLocalStreamCallback = onLocalStream;
    }
  }

  // --- Volume Monitoring ---
  startVolumeMonitoring(callback: (volume: number) => void) {
      if (this.volumeInterval) clearInterval(this.volumeInterval);
      this.onVolumeChangeCallback = callback;
      
      this.volumeInterval = setInterval(async () => {
          if (this.pc) {
              try {
                  const stats = await this.pc.getStats();
                  let maxAudioLevel = 0;
                  
                  stats.forEach((report: any) => {
                      // inbound-rtp for remote audio
                      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                          // Standard spec property: audioLevel (0.0 to 1.0)
                          if (typeof report.audioLevel === 'number') {
                              if (report.audioLevel > maxAudioLevel) {
                                  maxAudioLevel = report.audioLevel;
                              }
                          }
                      }
                  });
                  
                  if (this.onVolumeChangeCallback) {
                      this.onVolumeChangeCallback(maxAudioLevel);
                  }
              } catch (e) {
                  // Ignore stats errors
              }
          }
      }, 100); // 100ms polling (10fps)
  }

  stopVolumeMonitoring() {
      if (this.volumeInterval) {
          clearInterval(this.volumeInterval);
          this.volumeInterval = null;
      }
      this.onVolumeChangeCallback = null;
  }
  // -------------------------

  private async handleSignalingMessage(message: SignalingMessage) {
    switch (message.type) {
      case 'offer':
        if (this.pc) {
          await this.handleRenegotiationOffer(message.data);
        } else {
          this.friendId = message.senderId;
          this.pendingOffer = message.data;
        }
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

  private async handleRenegotiationOffer(data: any) {
    if (!this.pc || !this.isSupported()) return;

    const offerDescription = data.offer;
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
    
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await signalingService.sendSignal(this.friendId!, {
      type: 'answer',
      senderId: this.userId!,
      data: answer,
    });
  }

  private async renegotiate() {
    if (!this.pc || !this.friendId) return;

    console.log('[CallService] Renegotiating...');
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);

      await signalingService.sendSignal(this.friendId, {
        type: 'offer',
        senderId: this.userId!,
        data: { offer, isVideo: true },
      });
    } catch (e) {
      console.error('[CallService] Renegotiation failed', e);
    }
  }

  private async createPeerConnection() {
    if (!this.isSupported()) return;
    this.pc = new RTCPeerConnection(this.configuration);
    this.isRemoteDescriptionSet = false;
    this.pendingCandidates = [];

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

  async startCall(friendId: string, senderName: string, senderAvatar?: string, isVideo: boolean = false) {
    if (!this.isSupported()) return;
    this.friendId = friendId;
    
    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: isVideo ? {
        width: 1280,
        height: 720,
        frameRate: 30,
        facingMode: 'user',
      } : false,
    });

    if (this.onLocalStreamCallback) {
      this.onLocalStreamCallback(this.localStream);
    }

    await this.createPeerConnection();

    const offer = await this.pc!.createOffer({});
    await this.pc!.setLocalDescription(offer);

    await signalingService.sendSignal(friendId, {
      type: 'offer',
      senderId: this.userId!,
      senderName,
      senderAvatar,
      data: { offer, isVideo },
    });
  }

  async acceptCall(isVideo: boolean = false) {
    if (!this.isSupported() || !this.pendingOffer || !this.friendId) return;

    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: isVideo ? {
        width: 1280,
        height: 720,
        frameRate: 30,
        facingMode: 'user',
      } : false,
    });

    if (this.onLocalStreamCallback) {
      this.onLocalStreamCallback(this.localStream);
    }

    await this.createPeerConnection();

    const offerDescription = this.pendingOffer.offer || this.pendingOffer;

    await this.pc!.setRemoteDescription(new RTCSessionDescription(offerDescription));
    this.isRemoteDescriptionSet = true;
    await this.processPendingCandidates();

    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);

    await signalingService.sendSignal(this.friendId, {
      type: 'answer',
      senderId: this.userId!,
      data: answer,
    });

    this.pendingOffer = null;
  }

  async toggleVideo(enabled: boolean) {
    if (!this.localStream) return;

    const videoTracks = this.localStream.getVideoTracks();

    if (videoTracks.length > 0) {
      videoTracks.forEach((track: any) => {
        track.enabled = enabled;
      });
    } else if (enabled) {
      try {
        const streamWithVideo = await mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: 1280,
            height: 720,
            frameRate: 30,
            facingMode: 'user',
          },
        });

        const newVideoTrack = streamWithVideo.getVideoTracks()[0];
        if (newVideoTrack) {
          this.localStream.addTrack(newVideoTrack);
          
          if (this.onLocalStreamCallback) {
            this.onLocalStreamCallback(this.localStream);
          }

          if (this.pc) {
            this.pc.addTrack(newVideoTrack, this.localStream);
            await this.renegotiate();
          }
        }
      } catch (error) {
        console.error('Error enabling video track:', error);
      }
    }
  }

  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = enabled;
      });
    }
  }

  switchCamera() {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track: any) => {
        if (track._switchCamera) {
          track._switchCamera();
        }
      });
    }
  }

  private async handleAnswer(answer: any) {
    if (this.pc && this.isSupported()) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.isRemoteDescriptionSet = true;
      await this.processPendingCandidates();
    }
  }

  private async handleIceCandidate(candidate: any) {
    if (this.pc && this.isSupported()) {
      if (this.isRemoteDescriptionSet) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.pendingCandidates.push(candidate);
      }
    }
  }

  private async processPendingCandidates() {
    if (this.pc && this.pendingCandidates.length > 0) {
      for (const candidate of this.pendingCandidates) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingCandidates = [];
    }
  }

  endCall(notifyFriend: boolean = true) {
    this.stopVolumeMonitoring(); // Stop monitoring on end
    
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
    this.isRemoteDescriptionSet = false;
    this.pendingCandidates = [];

    if (this.onCallEndCallback) {
      this.onCallEndCallback();
    }
  }

  getLocalStream() {
    return this.localStream;
  }
}

export const callService = new CallService();