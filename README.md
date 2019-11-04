# Exokit Multiplayer

WebRTC multiplayer presence.

## How it works

```
import {XRChannelConnection, XRPeerConnection} from 'https://multiplayer.exokit.org/multiplayer.js';

const presenceUrl = `wss://presence.exokit.org/?u=username&c=channel`;
const xrChannelConnection = new XRChannelConnection(presenceUrl, {
  // all options are optional

  // navigator.mediaDevices.getUserMedia({audio: true}); // microphone input for voice chat
  microphoneMediaStream,
});
xrChannelConnection.addEventListener('open', () => {
  console.log('xr channel open');
});
xrChannelConnection.addEventListener('error', err => {
  console.warn('xr channel error', err);
});
xrChannelConnection.addEventListener('peerconnection', e => {
  const peerConnection = e.detail; // XRPeerConnection

  let updateInterval = 0;
  peerConnection.addEventListener('open', () => {
    console.log('peer connection open', peerConnection);

    // send updates
    updateInterval = setInterval(() => {
      const hmd = {
        position: [0, 0, 0],
        quaternion: [0, 0, 0,1 ],
      };
      const gamepads = [
        {
          position: localVector.copy(rig.inputs.leftGamepad.position).divideScalar(heightFactor).toArray(),
          quaternion: rig.inputs.leftGamepad.quaternion.toArray(),
          pointer: rig.inputs.leftGamepad.pointer,
          grip: rig.inputs.leftGamepad.grip,
          visible: true,
        },
        {
          position: localVector.copy(rig.inputs.rightGamepad.position).divideScalar(heightFactor).toArray(),
          quaternion: rig.inputs.rightGamepad.quaternion.toArray(),
          pointer: rig.inputs.rightGamepad.pointer,
          grip: rig.inputs.rightGamepad.grip,
          visible: true,
        },
      ];
    }, 100);

    // send custom message
    peerConnection.send(JSON.stringify({
      method: 'customData',
      payload: 'lol',
    }));
  });
  peerConnection.addEventListener('close', () => {
    console.log('peer connection close', peerConnection);

    clearInterval(updateInterval);
  });
  peerConnection.addEventListener('pose', e => {
    const {detail: data} = e;
    const {hmd, gamepads} = data;

    // receive update in the same format as sent
  });
  peerConnection.addEventListener('message', e => {
    const data = JSON.parse(e.data);
    const {method} = data;
    if (method === 'customData') {
      const {payload} = data;

      // receive message in the same format as sent
    } else {
      console.warn(`unknown method: ${method}`);
    }
  });
});

xrChannelConnection.setMicrophoneMediaStream(microphoneMediaStream); // set microphoneMediaStream separately
```