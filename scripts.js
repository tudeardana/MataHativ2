const callVolunteerBtn = document.getElementById('callVolunteerBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream = null;
let peerConnection = null;

const iceServers = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        }
    ]
};

const socket = new WebSocket('ws://localhost:8080');

socket.onmessage = function(event) {
    try {
        const message = JSON.parse(event.data);

        switch (message.type) {
            case 'offer':
                handleOffer(message);
                break;
            case 'answer':
                handleAnswer(message);
                break;
            case 'candidate':
                handleCandidate(message);
                break;
            default:
                break;
        }
    } catch (e) {
        console.error('Error parsing WebSocket message:', e);
    }
};

function sendMessage(message) {
    socket.send(JSON.stringify(message));
}

function startCall() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localVideo.srcObject = stream;
            localStream = stream;

            peerConnection = new RTCPeerConnection(iceServers);

            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    sendMessage({
                        type: 'candidate',
                        candidate: event.candidate
                    });
                }
            };

            peerConnection.ontrack = event => {
                remoteVideo.srcObject = event.streams[0];
            };

            peerConnection.createOffer()
                .then(offer => {
                    return peerConnection.setLocalDescription(offer);
                })
                .then(() => {
                    sendMessage({
                        type: 'offer',
                        sdp: peerConnection.localDescription
                    });
                })
                .catch(error => console.error('Error starting call:', error));
        })
        .catch(error => console.error('Gagal mengakses media perangkat:', error));
}

function handleOffer(message) {
    if (!localStream) {
        console.error('Local stream belum tersedia');
        return;
    }

    if (peerConnection) {
        console.log('Peer connection sudah ada, menunggu offer');
        return;
    }

    peerConnection = new RTCPeerConnection(iceServers);

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            sendMessage({
                type: 'candidate',
                candidate: event.candidate
            });
        }
    };

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp))
        .then(() => {
            return peerConnection.createAnswer();
        })
        .then(answer => {
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
            sendMessage({
                type: 'answer',
                sdp: peerConnection.localDescription
            });
        })
        .catch(error => console.error('Error handling offer:', error));
}

function handleAnswer(message) {
    if (!peerConnection) {
        console.error('Peer connection tidak ada');
        return;
    }

    if (peerConnection.signalingState === 'stable') {
        console.log('Peer connection dalam status stable, menunggu negosiasi lainnya');
        return;
    }

    peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp))
        .then(() => {
            console.log('Remote description berhasil diatur');
        })
        .catch(error => {
            console.error('Error setting remote description:', error);
        });
}

function handleCandidate(message) {
    if (!peerConnection) {
        console.error('Peer connection tidak ada');
        return;
    }

    const candidate = new RTCIceCandidate(message.candidate);
    peerConnection.addIceCandidate(candidate)
        .catch(error => console.error('Error adding ice candidate:', error));
}

document.addEventListener('DOMContentLoaded', function() {
    if (callVolunteerBtn) {
        callVolunteerBtn.addEventListener('click', startCall);
    } else {
        console.error('Tombol Call Volunteer tidak ditemukan');
    }
});

socket.onopen = () => {
    console.log('WebSocket connection established');
};

socket.onerror = error => {
    console.error('WebSocket error:', error);
};

socket.onclose = () => {
    console.log('WebSocket connection closed');
};
