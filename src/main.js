import './index.html';

import {auth, signOut} from "podauth";
import Podchat from 'podchat-browser';

import Config from './scripts/Config';

var callInterval, callStartTime, callId, reconnectInterval, reconnectTime,
    callerTone = new Audio('./callerTone.ogg'),
    calleeTone = new Audio('./calleeTone.ogg');

callerTone.loop = true;
calleeTone.loop = true;


const env = 'local';

let chatAgent = new Podchat({
    appId: 'CallTest',
    socketAddress: Config[env].socketAddress,
    ssoHost: Config[env].ssoHost,
    platformHost: Config[env].platformHost,
    fileServer: Config[env].fileServer,
    podSpaceFileServer: Config[env].podSpaceFileServer,
    serverName: Config[env].serverName,
    grantDeviceIdFromSSO: false,
    enableCache: false,
    fullResponseObject: true,
    mapApiKey: Config.MAP_API_KEY,
    typeCode: "default",
    wsConnectionWaitTime: 500,
    connectionRetryInterval: 5000,
    connectionCheckTimeout: 10000,
    messageTtl: 24 * 60 * 60,
    reconnectOnClose: true,
    httpRequestTimeout: 30000,
    httpUploadRequestTimeout: 0,
    forceWaitQueueInMemory: true,
    asyncRequestTimeout: 50000,
    callRequestTimeout: 4000,
    callOptions: {
        callTurnIp: "46.32.6.188",
        callDivId: "call-div",
        callVideo: {
            minWidth: 320,
            minHeight: 180
        },
        callAudioTagClassName: "podcall-audio",
        callVideoTagClassName: "podcall-video",
        callPingInterval: 8000,
        noAnswerTimeout: 15000
    },
    asyncLogging: {
        onFunction: true,
        consoleLogging: true,
        onMessageReceive: false,
        onMessageSend: false,
        actualTiming: false
    }
});

auth({
    clientId: Config.CLIENT_ID,
    scope: "social:write",
    secure: window.location.href.indexOf('https') > -1,
    redirectUri: Config[env].redirectUrl,//Config.REDIRECT_URL,//(process.env.NODE_ENV == 'production'? Config.REDIRECT_URL : Config.REDIRECT_URL_LOCAL) ,
    onNewToken: token => {
        chatAgent.setToken(token);
    }
});

var callState = {
    callRequested: false,
    callStarted: false,
    callStartedElsewhere: false,
};
var participantIsOnline = false;


/*
* Main Chat Ready Listener
*/
chatAgent.on("chatReady", function () {
    document.getElementById('chat-connection-status').innerText = 'Chat is Ready 😉';
    document.getElementById('chat-user').innerText = chatAgent.getCurrentUser().name;
});

/**
 * Listen to Error Messages
 */
chatAgent.on("error", function (error) {
    console.log("Error ", error);

    if (error.code === 21) {
        document.getElementById('chat-connection-status').innerText = `Invalid Token!`;
    }
});

/**
 * Listen to Chat State Changes
 */
chatAgent.on("chatState", function (chatState) {
    switch (chatState.socketState) {
        case 0:
            document.getElementById('chat-connection-status').innerText = 'Socket is Connecting ...';
            break;

        case 1:
            reconnectInterval && clearInterval(reconnectInterval);
            document.getElementById('chat-connection-status').innerText = 'Socket is Connected';

            break;

        case 2:
            document.getElementById('chat-connection-status').innerText = 'Socket is Closing ...';
            break;

        case 3:
            reconnectTime = ~~(chatState.timeUntilReconnect / 1000);
            reconnectInterval && clearInterval(reconnectInterval);
            reconnectInterval = setInterval(() => {
                document.getElementById('chat-connection-status').innerText = `Reconnects in ${reconnectTime} seconds ...`;
                reconnectTime--;
            }, 1000);

            break;

        default:
            break;
    }
});

/*chatAgent.on('messageEvents', function (event) {
    console.log("chatAgent.on('messageEvents')", event);

    switch (event.type) {
        case 'MESSAGE_NEW':
            console.log("chatAgent.on('messageEvents').MESSAGE_NEW", event);
            break;
    }
})*/

/**
 * Listen to Call Events
 */
chatAgent.on('callEvents', function (event) {
    var type = event.type;
    console.log(event);

    switch (type) {
        case 'POOR_VIDEO_CONNECTION':
            const p = document.createElement('p');
            p.innerText = 'Connection is poor...';
            p.setAttribute("id",  'poorconnection-' + event.metadata.elementId);
            p.classList.add("poor-connection")
            if(!document.querySelector('#poorconnection-' + event.metadata.elementId)) {
                document.getElementById("call-div").appendChild(p)
                //document.getElementById("callParticipantWrapper-" + event.metadata.userId).appendChild(p);
            }
            break;
        case 'POOR_VIDEO_CONNECTION_RESOLVED':
            document.getElementById('poorconnection-' + event.metadata.elementId).remove();
            break;
        case 'CALL_STARTED_ELSEWHERE':
            callState.callStartedElsewhere = true;
            break;
        case 'RECEIVE_CALL': //code 73
            if(callState.callStarted || callState.callStartedElsewhere) {
                return;
            }
            callId = event.result.callId;
            document.getElementById('call-receive-id').innerText = event.result.callId;
            document.getElementById('call-div').innerHTML = '';

            document.getElementById('container').classList.add('blur');
            document.getElementById('call-duration').innerText = 0;

            document.getElementById('caller-modal').style.display = 'flex';
            document.getElementById('caller-name').innerText = event.result.creatorVO.name;
            document.getElementById('caller-image').src = event.result.creatorVO.image;

            calleeTone.play();
            break;
        case 'PARTNER_RECEIVED_YOUR_CALL':
            participantIsOnline = true;
            callRequestStateModifier('Ringing');
            break;
        case 'CALL_SESSION_CREATED':
            callId = event.result.callId;
            document.getElementById('call-receive-id').innerText = event.result.callId;
            document.getElementById('call-div').innerHTML = '';
            document.getElementById('call-duration').innerText = 0;

            if(event.result.conversationVO)
                chatAgent.getThreads({threadIds: [event.result.conversationVO.id]}, (thread) => {
                    document.getElementById('container').classList.add('blur');
                    document.getElementById('callee-modal').style.display = 'flex';
                    document.getElementById('callee-name').innerText = thread.result.threads[0].title;
                    document.getElementById('callee-image').src = thread.result.threads[0].image;

                    callerTone.play();
                });

            break;

        case 'CALL_STARTED':
            callState.callStarted = true;

            document.getElementById('call-receive-broker').innerText = event.result.chatDataDto.brokerAddress.split(',')[0];
            document.getElementById('call-receive-send').innerText = event.result.clientDTO.topicSend;
            document.getElementById('call-receive-receive').innerText = event.result.clientDTO.topicReceive;

            document.getElementById('callee-modal').style.display = 'none';
            document.getElementById('container').classList.remove('blur');

            callStartTime = new Date().getTime();

            stopCallTones();

            callInterval = setInterval(() => {
                let duration = Math.round((new Date().getTime() - callStartTime) / 1000);
                document.getElementById('call-duration').innerText = `${~~(duration / 3600)}h ${~~((duration % 3600) / 60)}m ${duration % 60}s`;
            }, 1000);
            break;

        case 'CALL_ENDED':
            callState.callStarted = false;
            callState.callStartedElsewhere = false;
            callState.callRequested = false;
            callId = null;
            document.getElementById('call-receive-id').innerText = '';
            document.getElementById('call-div').innerHTML = '';

            callInterval && clearInterval(callInterval);
            document.getElementById('call-div').innerHTML = '';

            document.getElementById('caller-modal').style.display = 'none';
            document.getElementById('callee-modal').style.display = 'none';
            document.getElementById('container').classList.remove('blur');

            stopCallTones();
            break;
        case 'CALL_STARTED_ELSEWHERE':
            document.getElementById('caller-modal').style.display = 'none';
            document.getElementById('container').classList.remove('blur');
            document.getElementById('callee-modal').style.display = 'none';
            break;
        case 'CALL_STATUS':
            // document.getElementById('call-socket-status').innerText = event.errorMessage;
            break;

        case 'CALL_ERROR':
            // document.getElementById('call-socket-status').innerText = event.errorMessage;
            stopCallTones();
            break;

        default:
            break;
    }
});

document.getElementById('internet-status').innerHTML = (window.navigator.onLine) ? 'Online' : 'Offline';
window.addEventListener('online', () => document.getElementById('internet-status').innerHTML = 'Online');
window.addEventListener('offline', () => document.getElementById('internet-status').innerHTML = 'Offline');

document.getElementById('acceptCall').addEventListener('click', () => {
    chatAgent.acceptCall({
        callId: callId,
        video: true,
        mute: false
    }, function (result) {
        document.getElementById('caller-modal').style.display = 'none';
        document.getElementById('container').classList.remove('blur');
    });

    stopCallTones();
});

document.getElementById('rejectCall').addEventListener('click', () => {
    chatAgent.rejectCall({callId: callId}, function (result) {
        document.getElementById('caller-modal').style.display = 'none';
        document.getElementById('container').classList.remove('blur');
    });

    stopCallTones();
});

document.getElementById('endCall').addEventListener('click', () => {
    document.getElementById('callee-modal').style.display = 'none';
    document.getElementById('container').classList.remove('blur');

    stopCallTones();
    callState.callRequested = false;
    chatAgent.rejectCall({callId: callId});
});

document.getElementById('reconnect-socket').addEventListener('click', (e) => {
    e.preventDefault();
    chatAgent.reconnect();
});

document.getElementById('call-p2p-participant').addEventListener('change', () => {
    document.getElementById('call-p2p-participant-text').value = document.getElementById('call-p2p-participant').value;
});

document.getElementById('start-call').addEventListener('click', () => {
    let partnerUsername = document.getElementById('call-p2p-participant-text').value;
    let threadId = document.getElementById('call-p2p-thread').value;

    if (partnerUsername) {
        chatAgent.createThread({
            "invitees": [
                {"id": partnerUsername, "idType": "TO_BE_USER_USERNAME"}
            ]
        }, (result) => {
            let newThreadId = result.result.thread.id;
            chatAgent.startCall({threadId: newThreadId, type: 'video'});
            callRequestStateModifier('Calling')
            callState.callRequested = true;
            waitForPartnerToAcceptCall()
        });
    } else if (threadId) {
        chatAgent.startCall({threadId: threadId, type: 'video'});
        callRequestStateModifier('Calling')
        callState.callRequested = true;
        waitForPartnerToAcceptCall()
    }
});
window.waitForPartnerToAcceptCallInterval = null;
var waitForPartnerToAcceptCallRetryCount = 0;
function waitForPartnerToAcceptCall() {
    window.waitForPartnerToAcceptCallInterval = setInterval(()=> {
        if(!callId || !callState.callRequested) {
            waitForPartnerToAcceptCallRetryCount = 0;
            clearInterval(window.waitForPartnerToAcceptCallInterval);
            return
        }
        if(!participantIsOnline && waitForPartnerToAcceptCallRetryCount < 8) {
            console.log("[call-full] Partner is not online..., we do nothing here, Retry counts: ", waitForPartnerToAcceptCallRetryCount);
            waitForPartnerToAcceptCallRetryCount++;
        } else {
            if(!participantIsOnline && waitForPartnerToAcceptCallRetryCount > 8) {
                console.log("[call-full] Partner is not online..., we retried 8 times...  ");
            } else {
                console.log("[call-full] Partner is now online..., we don't need to retry...");
            }

            waitForPartnerToAcceptCallRetryCount = 0;
            clearInterval(window.waitForPartnerToAcceptCallInterval);
        }
    }, 60000);
}

/*
document.getElementById('start-audio-call').addEventListener('click', () => {
    let partnerUsername = document.getElementById('call-p2p-participant').value;
    let threadId = document.getElementById('call-p2p-thread').value;

    if (partnerUsername) {
        chatAgent.createThread({
            "invitees": [
                {"id": partnerUsername, "idType": "TO_BE_USER_USERNAME"}
            ]
        }, (result) => {
            let newThreadId = result.result.thread.id;
            chatAgent.startCall({threadId: newThreadId, type: 'audio'});
        });
    } else if (threadId) {
        chatAgent.startCall({threadId: threadId, type: 'video'});
    }
});
*/



document.getElementById('restart-call').addEventListener('click', () => {
    chatAgent.restartMedia();
});

document.getElementById('end-call').addEventListener('click', () => {
    chatAgent.endCall({
        callId: callId
    }, (result) => {
        console.log(result)
    });

    callInterval && clearInterval(callInterval);

    callId = null;
    document.getElementById('call-receive-id').innerText = '';
    document.getElementById('call-div').innerHTML = '';

    callInterval && clearInterval(callInterval);
    document.getElementById('call-div').innerHTML = '';

    document.getElementById('caller-modal').style.display = 'none';
    document.getElementById('callee-modal').style.display = 'none';
    document.getElementById('container').classList.remove('blur');

    stopCallTones();
});

document.getElementById('start-recording-call').addEventListener('click', () => {
    console.log('Start Recording Call')
    chatAgent.startRecordingCall({
        callId: callId
    }, (result) => {
        console.log(result);
    });
});

document.getElementById('stop-recording-call').addEventListener('click', () => {
    chatAgent.stopRecordingCall({
        callId: callId
    }, (result) => {
        console.log(result);
    });
});

document.getElementById('sign-out').addEventListener('click', () => {
    signOut();
});

document.getElementById('call-p2p-participant').addEventListener('change', (event) => {
    if (event.target.value) {
        document.getElementById('call-p2p-thread').value = '';
    }
});

document.getElementById('call-p2p-thread').addEventListener('keyup', (event) => {
    if (event.target.value) {
        document.getElementById('call-p2p-participant').value = '';
    }
});

var pausedCamera = false;
document.getElementById('toggle-camera').addEventListener('click', (event) => {
    event.preventDefault();
    if(!pausedCamera)  {
        pausedCamera = true;
        chatAgent.pauseCamera();
    } else {
        pausedCamera = false;
        chatAgent.resumeCamera();
    }
});
var pausedMice = false;
document.getElementById('toggle-mice').addEventListener('click', (event) => {
    event.preventDefault();
    if(!pausedMice)  {
        pausedMice = true;
        chatAgent.pauseMice();
    } else {
        pausedMice = false;
        chatAgent.resumeMice();
    }
});


var screenSharingState = false;
document.getElementById('toggle-screen-share').addEventListener('click', (event) => {
    event.preventDefault();
    if(!screenSharingState)  {
        screenSharingState = true;
        chatAgent.startScreenShare({
            callId: callId
        });
    } else {
        screenSharingState = false;
        chatAgent.endScreenShare({
            callId: callId,
            startCamera: true
        });
    }
});

function stopCallTones() {
    calleeTone.pause();
    calleeTone.currentTime = 0;

    callerTone.pause();
    callerTone.currentTime = 0;
}

function callRequestStateModifier(state) {
    console.log(state);
    document.getElementById("calling-state").innerHTML = state;
}
