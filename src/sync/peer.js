import { encode, decode, MSG } from './protocol.js';
import { state } from '../main.js';

const ICE_CONFIG = {
  iceServers: [], // No STUN/TURN needed on LAN
};

/**
 * Create a host connection that can accept multiple camera peers.
 * Returns the SDP offer (compressed string) to display as QR.
 */
export async function createHost() {
  const peers = [];
  let currentPeer = null;

  async function createOffer() {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    const dc = pc.createDataChannel('ballmeter', { ordered: true });

    currentPeer = { pc, dc, connected: false, role: null };

    dc.onopen = () => {
      currentPeer.connected = true;
      const role = peers.length === 0 ? 'side' : peers.length === 1 ? 'behind' : 'extra';
      currentPeer.role = role;
      state.peers.push({ role, connection: currentPeer });
      dc.send(encode({ type: MSG.ROLE_ASSIGN, role }));
    };

    dc.onmessage = (e) => {
      const msg = decode(e.data);
      if (msg && currentPeer.onMessage) currentPeer.onMessage(msg);
    };

    dc.onclose = () => {
      currentPeer.connected = false;
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete (vanilla ICE)
    await waitForICE(pc);

    const sdp = pc.localDescription.sdp;
    peers.push(currentPeer);

    return sdp;
  }

  const offerSDP = await createOffer();

  return {
    offer: offerSDP,

    async acceptAnswer(answerSDP) {
      if (currentPeer && currentPeer.pc.signalingState === 'have-local-offer') {
        await currentPeer.pc.setRemoteDescription({
          type: 'answer',
          sdp: answerSDP,
        });
      }
    },

    broadcast(msg) {
      const data = encode(msg);
      for (const peer of peers) {
        if (peer.dc && peer.dc.readyState === 'open') {
          peer.dc.send(data);
        }
      }
    },

    async addPeer() {
      const newOffer = await createOffer();
      return newOffer;
    },

    getPeers() {
      return peers.filter(p => p.connected);
    },
  };
}

/**
 * Create a camera peer that connects to a host.
 * Takes the host's SDP offer, returns an SDP answer to display as QR.
 */
export async function createCamera(offerSDP) {
  const pc = new RTCPeerConnection(ICE_CONFIG);
  let dc = null;
  let onConnected = null;
  let onMessage = null;

  pc.ondatachannel = (e) => {
    dc = e.channel;
    dc.onopen = () => {
      if (onConnected) onConnected();
    };
    dc.onmessage = (e) => {
      const msg = decode(e.data);
      if (msg && onMessage) onMessage(msg);
    };
  };

  await pc.setRemoteDescription({ type: 'offer', sdp: offerSDP });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await waitForICE(pc);

  const answerSDP = pc.localDescription.sdp;

  return {
    answer: answerSDP,

    send(msg) {
      if (dc && dc.readyState === 'open') {
        dc.send(encode(msg));
      }
    },

    set onConnected(fn) { onConnected = fn; },
    get onConnected() { return onConnected; },
    set onMessage(fn) { onMessage = fn; },
    get onMessage() { return onMessage; },
  };
}

/**
 * Wait for ICE gathering to complete so all candidates are in the SDP.
 */
function waitForICE(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const timeout = setTimeout(resolve, 3000); // 3s max wait
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}

/**
 * Destroy all host connections.
 */
export function destroyHost() {
  for (const peer of state.peers) {
    if (peer.connection?.pc) {
      peer.connection.pc.close();
    }
  }
  state.peers = [];
  state.hostConnection = null;
}
