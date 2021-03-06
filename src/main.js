import './index.html'
import {auth, signOut} from "podauth";
import Podchat from 'podchat-browser';

import Config from './scripts/Config';

const stickersList = [
    "https://s6.uupload.ir/files/sad_9l0a.gif"
    , "https://s6.uupload.ir/files/bored_9wug.gif"
    , "https://s6.uupload.ir/files/cool-beefy_q8ta.gif"
    , "https://s6.uupload.ir/files/cool_ghzq.gif"
    , "https://s6.uupload.ir/files/crazy_uyo.gif"
    , "https://s6.uupload.ir/files/disappointed_vqiq.gif"
    , "https://s6.uupload.ir/files/happy_9dap.gif"
    , "https://s6.uupload.ir/files/positive_fp8z.gif"
    , "https://s6.uupload.ir/files/negative_kgkq.gif"
    , "https://s6.uupload.ir/files/sports_q095.gif"
    , "https://s6.uupload.ir/files/sunglasses-smoking_82m5.gif"
    , "https://s6.uupload.ir/files/thinking_zecc.gif"
    , "https://s6.uupload.ir/files/tongue-out-teasing_kuy2.gif"
    , "https://s6.uupload.ir/files/kittens_atln.gif"
];
const textStickersList = [
    'سلام به همه', 'درود بر شما', 'سلام عمو',
    'ایول', 'مرسی', 'دمت گرم',
    'صدام میاد ؟', 'صداتو ندارم', 'تصویرم هست ؟', 'تصویرتو ندارم', 'اره اوکی شد!',
    'وبکمم باز مونده', 'خطای کنسولی دارم', 'کانکشنت ضعیف شد', 'برو تب Network و WS رو ببین',
    'مشکل تو SDK ه', 'مشکل تو چته', 'مشکل تو کامه',
    'من حرف بزنم ؟', 'آب قطعه', 'Such a WoW', '!! نگا اسنیل گنگو !!'
]

var callInterval, callStartTime, callId, newCallId, reconnectInterval, reconnectTime,
    callerTone = new Audio('./callerTone.ogg'),
    calleeTone = new Audio('./calleeTone.ogg');

callerTone.loop = true;
calleeTone.loop = true;

let wantsToJoinAGroupCall = false
    , callUsersListElement = document.getElementById("call-participants-list")
    , currentCallThreadId;

let chatAgent = new Podchat({
    appId: 'CallTest',
    socketAddress: Config[Config.env].socketAddress,
    ssoHost: Config[Config.env].ssoHost,
    platformHost: Config[Config.env].platformHost,
    fileServer: Config[Config.env].fileServer,
    podSpaceFileServer: Config[Config.env].podSpaceFileServer,
    serverName: Config[Config.env].serverName,
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
    callRequestTimeout: 15000,
    callOptions: {
        callNoAnswerTimeout: 20000,
        useInternalTurnAddress: false,
        callTurnIp: "46.32.6.188",
        callDivId: "call-div",
        callVideo: {
            minWidth: 320,
            minHeight: 180
        },
        callAudioTagClassName: "podcall-audio",
        callVideoTagClassName: "podcall-video",
/*        callPingInterval: 8000,
        noAnswerTimeout: 15000*/
    },
    asyncLogging: {
        onFunction: true,
        consoleLogging: true,
        onMessageReceive: false,
        onMessageSend: false,
        actualTiming: false
    }
});

window.chatAgent = chatAgent;

auth({
    clientId: Config.CLIENT_ID,
    scope: "social:write",
    secure: window.location.href.indexOf('https') > -1,
    redirectUri: Config[Config.env].redirectUrl,//Config.REDIRECT_URL,//(process.env.NODE_ENV == 'production'? Config.REDIRECT_URL : Config.REDIRECT_URL_LOCAL) ,
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

var callDivs;
/**
 * Listen to Call Events
 */
chatAgent.on('callEvents', function (event) {
    var type = event.type;
    console.log(event);

    switch (type) {
        case 'CALL_DIVS':
            callDivs = event.result.uiElements;
            console.log({callDivs});

            for(var i in callDivs) {
                if(i === 'screenShare' && !document.getElementById('closeFullScreenSharing')) {
                    //callDivs[i].container.append("<button id='closeFullScreenSharing' >Close</button>");
                    callDivs[i].container.innerHTML +=  "<button id='closeFullScreenSharing' >Close</button>"
                }
            }
            break;

        case 'POOR_VIDEO_CONNECTION':
            const p = document.createElement('p');
            p.innerText = 'Connection is poor...';
            p.setAttribute("id",  'poorconnection-' + event.metadata.elementId);
            p.classList.add("poor-connection")
            if(!document.querySelector('#poorconnection-' + event.metadata.elementId)) {
                //document.getElementById("call-div").appendChild(p);
                document.getElementById("call-div").appendChild(p);
                if(callDivs[event.metadata.userId]) {
                    callDivs[event.metadata.userId].container.appendChild(p)
                }
                //document.getElementById("callParticipantWrapper-" + event.metadata.userId).appendChild(p);
            }

            break;
        case 'POOR_VIDEO_CONNECTION_RESOLVED':
            // if(callDivs[event.metadata.userId]) {
            //     callDivs[event.metadata.userId].container.appendChild(p)
            // }
            document.getElementById('poorconnection-' + event.metadata.elementId).remove();
            break;
        case 'CALL_STARTED_ELSEWHERE':
            callState.callStartedElsewhere = true;
            break;
        case 'RECEIVE_CALL': //code 73, 91
            /* if(callState.callStarted || callState.callStartedElsewhere) {
                return;
            } */
            if(event.result.callId) {
                if(!callId)
                    callId = event.result.callId;
                else
                    newCallId = event.result.callId;
            }

            console.log({callId, newCallId})
/*
            document.getElementById('call-receive-id').innerText = event.result.callId;
            document.getElementById('call-div').innerHTML = '';
*/
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

            if(event.result.conversationVO){
                currentCallThreadId = event.result.conversationVO.id
                chatAgent.getThreads({threadIds: [event.result.conversationVO.id]}, (thread) => {
                    document.getElementById('container').classList.add('blur');
                    document.getElementById('callee-modal').style.display = 'flex';
                    document.getElementById('callee-name').innerText = thread.result.threads[0].title;
                    document.getElementById('callee-image').src = thread.result.threads[0].image;

                    callerTone.play();
                });
            }

            break;

        case 'CALL_STARTED':
            document.getElementById("call-participants-list-container").classList.add("visible")

            chatAgent.getCallParticipants({
                callId
            });

            if(wantsToJoinAGroupCall) {
                callId = document.getElementById("groupCallId").value;
            }
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
            if(event.callId != callId) {
                document.getElementById('caller-modal').style.display = 'none';
                document.getElementById('callee-modal').style.display = 'none';
                document.getElementById('container').classList.remove('blur');
                stopCallTones();
            } else {
                callState.callStarted = false;
                callState.callStartedElsewhere = false;
                callState.callRequested = false;
                callId = null;

                removeParticipantsElements();
                document.getElementById('call-receive-id').innerText = '';
                document.getElementById('call-div').innerHTML = '';

                callInterval && clearInterval(callInterval);
                document.getElementById('call-div').innerHTML = '';

                document.getElementById('caller-modal').style.display = 'none';
                document.getElementById('callee-modal').style.display = 'none';
                document.getElementById('container').classList.remove('blur');

                stopCallTones();
            }
            break;
        case 'CALL_STARTED_ELSEWHERE':
            document.getElementById('caller-modal').style.display = 'none';
            document.getElementById('container').classList.remove('blur');
            document.getElementById('callee-modal').style.display = 'none';
            break;

        case "CALL_PARTICIPANTS_LIST_CHANGE":
            console.log(event)
            callUsersListElement.innerHTML = '';
            for(let i in event.result.participants) {
                let user = event.result.participants[i].participantVO
                callUsersListElement.append(createCallParticipantTemplate({
                    userId: user.id,
                    username: user.username,
                    image: user.image
                }));
            }
            break;
        case "CALL_PARTICIPANT_JOINED":
            chatAgent.getCallParticipants({
                callId
            });
            break;
        case "CALL_PARTICIPANT_LEFT":
            chatAgent.getCallParticipants({
                callId
            });
            break;
        case "CALL_PARTICIPANT_MUTE":
            addParticipantMute(event.result[0].userId);
            break;
        case "CALL_PARTICIPANT_UNMUTE":
            removeParticipantMute(event.result[0].userId);
            break;

        case 'CALL_STATUS':
            // document.getElementById('call-socket-status').innerText = event.errorMessage;
            break;

        case 'CALL_ERROR':
            // document.getElementById('call-socket-status').innerText = event.errorMessage;
            stopCallTones();
            break;
        case 'CUSTOM_USER_METADATA':
            showStickerIfNecessary(event)
            break;

        default:
            break;
    }
});

chatAgent.on("callStreamEvents", function (event) {
    // console.log(event)

    switch (event.type) {
        case 'USER_SPEAKING':
            showVoiceIndicator(event)
            break;
    }

});

function showVoiceIndicator(data){
    let el = document.querySelector('#speaking-indicator-' + data.userId)
    if(!el) {
        el = document.createElement('div');
        el.setAttribute("id",  'speaking-indicator-' + data.userId);
        el.setAttribute('level', data.audioLevel)
        el.style.position = 'absolute';
        el.style.bottom = 0;
        el.style.width = '100%';
        el.style.backgroundColor = 'rgba(100, 100, 100, .3)';
        el.style.height = `${(data.audioLevel * 10) }%`;
        el.classList.add("speaking-indicator");
        if(callDivs[data.userId]) {
            callDivs[data.userId].container.appendChild(el);
        }
        //document.getElementById("callParticipantWrapper-" + event.metadata.userId).appendChild(p);
    } else {
        el.style.height = `${(data.audioLevel * 10) }%`;
    }
}

function createCallParticipantTemplate(userInfo) {
    var userDiv = document.createElement("div");

    userDiv.setAttribute("id", "participant-item-" + userInfo.userId);
    userDiv.setAttribute("class", "participant-item");
    userDiv.style.position = 'relative';
    userDiv.style.width = '15%';
    userDiv.style.padding = '5px';

    var data = `<img src="${userInfo.image}" style="width: 100%; position:relative;" alt="">
                <div>${userInfo.username}</div>`;

    userDiv.innerHTML = data;
    return userDiv
}

function addParticipantMute(userId){
    if(document.querySelector('#participant-item-' + userId)){
        let  el = document.querySelector('#participant-item-' + userId);
        let mute = document.createElement("div")
        mute.setAttribute("id", 'participant-mute-' + userId)
        mute.innerText = "Muted";
        el.appendChild(mute);
    }
}

function removeParticipantMute(userId) {
    if(document.querySelector('#participant-mute-' + userId)) {
        document.querySelector('#participant-mute-' + userId).remove();
    }
}

function removeParticipantsElements() {
    document.getElementById("call-participants-list-container").classList.remove("visible")
    callUsersListElement.innerHTML = '';
}

function removeParticipantElement(userId) {
    if(document.querySelector('#participant-item-' + userId))
        document.querySelector('#participant-item-' + username).remove();

}

document.getElementById('internet-status').innerHTML = (window.navigator.onLine) ? 'Online' : 'Offline';
window.addEventListener('online', () => document.getElementById('internet-status').innerHTML = 'Online');
window.addEventListener('offline', () => document.getElementById('internet-status').innerHTML = 'Offline');

/* document.getElementById('acceptCallVideo').addEventListener('click', () => {
    chatAgent.acceptCall({
        callId: callId,
        video: true,
        mute: false,
        cameraPaused: false
    }, function (result) {
        document.getElementById('caller-modal').style.display = 'none';
        document.getElementById('container').classList.remove('blur');
    });

    stopCallTones();
}); */
/* document.getElementById('acceptCallAudio').addEventListener('click', () => {
    chatAgent.acceptCall({
        callId: callId,
        video: false,
        mute: false,
        cameraPaused: false
    }, function (result) {
        document.getElementById('caller-modal').style.display = 'none';
        document.getElementById('container').classList.remove('blur');
    });

    stopCallTones();
}); */

document.getElementById('rejectCall').addEventListener('click', () => {
    console.log({callId, newCallId});
    var cId = newCallId ? newCallId : callId;
    chatAgent.rejectCall({callId: cId}, function (result) {
        document.getElementById('caller-modal').style.display = 'none';
        document.getElementById('container').classList.remove('blur');
    });

    stopCallTones();
});

document.getElementById('endCall').addEventListener('click', () => {
    document.getElementById('callee-modal').style.display = 'none';
    document.getElementById('container').classList.remove('blur');
    console.log({callId, newCallId});
    stopCallTones();
    callState.callRequested = false;
    var cId = newCallId ? newCallId : callId;
    chatAgent.rejectCall({callId: cId});
});

document.getElementById('reconnect-socket').addEventListener('click', (e) => {
    e.preventDefault();
    chatAgent.reconnect();
});

document.getElementById('call-p2p-participant').addEventListener('change', () => {
    document.getElementById('call-p2p-participant-text').value = document.getElementById('call-p2p-participant').value;
});

/*document.getElementById('start-video-call').addEventListener('click', () => {
    let partnerUsername = document.getElementById('call-p2p-participant-text').value;
    let threadId = document.getElementById('call-p2p-thread').value;

    if (partnerUsername) {
        chatAgent.createThread({
            "invitees": [
                {"id": partnerUsername, "idType": "TO_BE_USER_USERNAME"}
            ]
        }, (result) => {
            console.log(result)
            let newThreadId = result.result.thread.id;
            chatAgent.getThreadParticipants({
                threadId: newThreadId
            }, function (res) {
                console.log("[call-full][getThreadParticipants]", newThreadId, res);
                chatAgent.startCall({threadId: newThreadId, type: 'video'});
                callRequestStateModifier('Calling')
                callState.callRequested = true;
                waitForPartnerToAcceptCall()
            })
        });
    } else if (threadId) {
        chatAgent.startCall({threadId: threadId, type: 'video'});
        callRequestStateModifier('Calling')
        callState.callRequested = true;
        waitForPartnerToAcceptCall()
    }
});
document.getElementById('start-audio-call').addEventListener('click', () => {
    let partnerUsername = document.getElementById('call-p2p-participant-text').value;
    let threadId = document.getElementById('call-p2p-thread').value;

    if (partnerUsername) {
        chatAgent.createThread({
            "invitees": [
                {"id": partnerUsername, "idType": "TO_BE_USER_USERNAME"}
            ]
        }, (result) => {
            console.log(result)
            let newThreadId = result.result.thread.id;
            chatAgent.getThreadParticipants({
                threadId: newThreadId
            }, function (res) {
                console.log("[call-full][getThreadParticipants]", newThreadId, res);
                chatAgent.startCall({threadId: newThreadId, type: 'voice'});
                callRequestStateModifier('Calling')
                callState.callRequested = true;
                waitForPartnerToAcceptCall()
            })
        });
    } else if (threadId) {
        chatAgent.startCall({threadId: threadId, type: 'voice'});
        callRequestStateModifier('Calling')
        callState.callRequested = true;
        waitForPartnerToAcceptCall()
    }
});*/

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


document.getElementById('restart-call').addEventListener('click', () => {
    chatAgent.restartMedia();
});

document.getElementById('end-call').addEventListener('click', () => {
    chatAgent.endCall({
        callId: callId
    }, (result) => {
        console.log(result);
    });
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
            callId: callId
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


document.getElementById("customRecordingStart").addEventListener("click", function (event) {
    event.preventDefault();
    var thread = document.getElementById("customRecordingThreadId").value;
    if(!thread) {
        console.log("[call-full][customRecordingStart] Error thread id is required")
        return;
    }
    var tags = document.getElementById("customRecordingTags").value;
    if(tags && tags.length && tags.indexOf(",") !== false) {
        tags = tags.split(",")
    }
//customRecordingcallId
    var othersCallId = document.getElementById("customRecordingCallId").value;

    chatAgent.startRecordingCall({
        destinated: true,
        callId: othersCallId,
        threadId: thread,
        tags: tags
    }, function (result) {
        console.log(result);
    })
});
document.getElementById("customRecordingStop").addEventListener("click", function (event) {
    event.preventDefault();
    chatAgent.startRecordingCall({
        callId: callId,
    })
});
var videoStreamState = true;
document.getElementById("toggle-video-stream").addEventListener("click", function (event) {
    event.preventDefault();
    if(videoStreamState){
        chatAgent.turnOffVideoCall({
            callId: callId,
        });
        videoStreamState = false
    } else {
        videoStreamState = true;
        chatAgent.turnOnVideoCall({
            callId: callId,
        });
    }
});
var micIsMute = false;
document.getElementById("toggle-microphone-stream").addEventListener("click", function (event) {
    event.preventDefault();
    if(micIsMute){
        chatAgent.unMuteCallParticipants({
            callId: callId,
            userIds: [
                chatAgent.getCurrentUser().id
            ]
        });
        micIsMute = false
    } else {
        micIsMute = true;
        console.log("[call-full][chatAgent.getUserInfo] result", chatAgent.getCurrentUser())
        chatAgent.muteCallParticipants({
            callId: callId,
            userIds: [
                chatAgent.getCurrentUser().id
            ]
        });
    }
});

document.getElementById("add-participant-to-call").addEventListener("click", function (event) {
    event.preventDefault();

    var newUser = document.getElementById("newParticipantUserName").value;

    chatAgent.addCallParticipants({
        callId,
        //coreUserids: [1111, 2222],
        //contactIds: [1111, 2222],
        usernames: [newUser] //['f.naysee']
    })
})

document.getElementById("startGroupCall").addEventListener("click", function (event) {
   event.preventDefault();
    var threadId = document.getElementById("groupCallThreadId").value
        , video =  document.getElementById("groupCallVideoCheckBox").checked
        , user1 =  document.getElementById("groupCallUserName1").value
        , user2 =  document.getElementById("groupCallUserName2").value
        , user3 =  document.getElementById("groupCallUserName3").value

    var params = {}, userNames = []
    if(video)
        params.type = 'video';
    else
        params.type = 'voice'

    if(threadId && threadId.length) {
        params.threadId = threadId
    } else {
        if(user1 && user1.length)  {
            userNames.push({"id": user1, "idType": 2})
        }
        if(user2 && user2.length)  {
            userNames.push({"id": user2, "idType": 2})
        }
        if(user3 && user3.length)  {
            userNames.push({"id": user3, "idType": 2})
        }

        params.invitees = userNames
    }

/*    if(!params.threadId ) {
        console.log("[call-full] Can not start group call without threadID");
        return
    }*/

    //if(!params.threadId) {

        //params.invitees = userNames;
    //} else {
        chatAgent.startGroupCall(params);
    //}
})

document.getElementById("terminateGroupCall").addEventListener("click", function (event) {
   event.preventDefault();
   if(callId) {
       chatAgent.terminateCall({callId});
   }
})

/*document.getElementById("sendTestMetadata").addEventListener("click", function (event) {
    event.preventDefault();
    chatAgent.sendCallMetaData({callId ,message: 'hi'}, function (result) {
        console.log(result)
    });
})*/

document.getElementById("startCall").addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    var video = document.getElementById("startCallVideoCheckMark").checked;
    var mute = document.getElementById("startCallMuteCheckMark").checked;

    let partnerUsername = document.getElementById('call-p2p-participant-text').value;
    let threadId = document.getElementById('call-p2p-thread').value;

    if (partnerUsername) {
        chatAgent.createThread({
            "invitees": [
                //{"id": partnerUsername, "idType": "TO_BE_USER_USERNAME"}
                {"id": partnerUsername, "idType": "TO_BE_USER_USERNAME"}
            ]
        }, function (result) {
            if(result.hasError) {
                console.log(result);
                return;
            }

            let newThreadId = result.result.thread.id;
            // chatAgent.getThreadParticipants({
            //     threadId: newThreadId
            // }, function (res) {
            //     console.log("[call-full][getThreadParticipants]", newThreadId, res);


                chatAgent.startCall({threadId: newThreadId, type: (video ? 'video' : 'voice'), mute: mute});
                callRequestStateModifier('Calling')
                callState.callRequested = true;
                waitForPartnerToAcceptCall()


            //})
        });

        /*chatAgent.startCall({
             //threadId: newThreadId,
             "invitees": [
                {"id": partnerUsername, "idType": "TO_BE_USER_USERNAME"},//"TO_BE_USER_USERNAME"},
                //{"id": "f.naysee", "idType": "TO_BE_USER_USERNAME"}
             ],
             type: (video ? 'video' : 'voice'),
             mute: mute,
             threadInfo: {
                 title: 'Chat test',
                 description: 'Test'
             }
        });*/

        // callRequestStateModifier('Calling')
        // callState.callRequested = true;
        // waitForPartnerToAcceptCall()

        /*"invitees": [
            {"id": partnerUsername, "idType": "TO_BE_USER_USERNAME"}
        ]*/
    } else if (threadId) {
        chatAgent.startCall({threadId: threadId, type: 'voice'});
        callRequestStateModifier('Calling')
        callState.callRequested = true;
        waitForPartnerToAcceptCall()
    }
});


document.getElementById('acceptCall').addEventListener('click', () => {
    var video = document.getElementById("acceptCallVideoCheckMark").checked;
    var mute = document.getElementById("acceptCallMuteCheckMark").checked;

    chatAgent.acceptCall({
        callId: callId,
        video: video,
        mute: mute,
        cameraPaused: false
    }, function (result) {
        document.getElementById('caller-modal').style.display = 'none';
        document.getElementById('container').classList.remove('blur');
    });

    stopCallTones();
});

document.getElementById("getCallParticipants").addEventListener("click", function (event) {
    event.preventDefault();

    chatAgent.getCallParticipants({
        callId
    })
});


document.getElementById("sendTestMetadata").addEventListener("click", function (event) {
    event.preventDefault();
    var content = document.getElementById("metadataContent").value;
    chatAgent.sendCallMetaData({
        content: content
    });
});

document.getElementById("joinTheCall").addEventListener("click", function (event) {
    event.preventDefault();
    var cId = document.getElementById("groupCallId").value;
    var video = document.getElementById("joinCallVideoCheckMark").checked;
    var mute = document.getElementById("joinCallMuteCheckMark").checked;

    callId = cId;

    chatAgent.acceptCall({
        callId: callId,
        video: video,
        mute: mute,
        cameraPaused: false,
        joinCall: true
    }, function (result) {
        // document.getElementById('caller-modal').style.display = 'none';
        // document.getElementById('container').classList.remove('blur');
    });
})

document.body.addEventListener('click', function (event) {

    if(event.target.id === 'closeFullScreenSharing') {
        event.preventDefault();
        callDivs['screenShare'].container.classList.remove('fullSizeScreenShare');
    }
})

document.getElementById("makeScreenShareFullScreen").addEventListener("click", function (event) {
    event.preventDefault();

    for(var i in callDivs) {
        if (i === 'screenShare') {
            callDivs[i].container.classList.add('fullSizeScreenShare');
        }
    }
});

window.setScreenShareSize = function (quality) {
    chatAgent.resizeScreenShare({
        quality: quality //Possible values: 1,2,3,4
    });
}

var videoReceiveEnabled = true;
document.getElementById("toggle-others-video").addEventListener("click", function (event) {
    event.preventDefault();
    var myId = chatAgent.getCurrentUser().id;

    var ids = Object.keys(callDivs),
        filteredIds = [];

    for(var i of ids) {
        if(i !== 'screenShare' && +i !== myId) {
            filteredIds.push(i)
        }
    }

    if(videoReceiveEnabled) {
        console.log("[call-full] Video receive is enabled, now disabling...", filteredIds);
        chatAgent.disableParticipantsVideoReceive({
            userIds: filteredIds
        });
        videoReceiveEnabled = false;
    } else {
        console.log("[call-full] Video receive is disabled, now enabling...");
        chatAgent.enableParticipantsVideoReceive({
            userIds:  filteredIds
        });
        videoReceiveEnabled = true;
    }
});


function showStickerIfNecessary(event) {
    if(event.content
        && (
            event.content.sender !== 'callFull'
            || (event.content.eventType !== 'showSticker' && event.content.eventType !== 'showTextSticker')
        ))
        return;

    switch (event.content.eventType) {
        case 'showTextSticker':
            showTextSticker(event)
            break;
        case 'showSticker':
            showImageSticker(event)
            break
    }

}

function showTextSticker(event) {
    let el = document.querySelector('#sticker-box-video-' + event.userId)
    if(el)
        el.remove();

    el = document.createElement('div');
    el.setAttribute("id",  'sticker-box-video-' + event.userId);
    el.classList.add("sticker-box-video");

    let sticker = document.createElement("span");
    sticker.style.opacity = '.9';
    sticker.style.color = '#fff';
    sticker.style.fontSize = '20px';
    sticker.style.direction = 'rtl';
    sticker.innerText = event.content.name

    el.appendChild(sticker);
    if(callDivs[event.userId]) {
        callDivs[event.userId].container.appendChild(el);
        setTimeout(function () {
            el.remove();
            //document.getElementById("sticker-box-video-" + event.userId).remove()
        }, 5000)
    }
}
function showImageSticker(event) {
    let el = document.querySelector('#sticker-box-avatar-' + event.userId)
    if(el)
        el.remove();

    el = document.createElement('div');
    el.setAttribute("id",  'sticker-box-avatar-' + event.userId);
    el.classList.add("sticker-box-avatar");

    let sticker = document.createElement("img");
    sticker.style.width = '90px';
    sticker.style.height = '90px';
    sticker.style.opacity = '.9'

    for(let stick of stickersList) {
        if(stick.indexOf(event.content.name) !== -1) {
            sticker.setAttribute("src",  stick);
        }
    }

    el.appendChild(sticker);
    if(callDivs[event.userId]) {
        if(document.querySelector('#participant-item-' + event.userId)){
            let  elp = document.querySelector('#participant-item-' + event.userId);
            elp.appendChild(el);
        }
        setTimeout(function () {
            el.remove();
            //document.getElementById("sticker-box-avatar-" + event.userId).remove()
        }, 5000)
    }
}

let stickersContainer = document.getElementById("stickers");
let breakLine = document.createElement("br")
for(let sticky of stickersList){
    let element = document.createElement('img');
    element.setAttribute('src', sticky);
    element.setAttribute("class", 'sticker')
    element.style.width = '40px'
    element.style.height = '40px'
    stickersContainer.append(element);
}

stickersContainer.append(breakLine);
for(let sticky of textStickersList){
    let element = document.createElement('a');
    element.innerText = sticky;
    element.setAttribute("class", 'text-sticker')
    stickersContainer.append(element);
}

var sendSticker = function() {
    if(!callId) {
        console.warn("[call-full] Start call to send stickers");
        return;
    }

    let src = this.getAttribute("src")
        , data = src.split('/');

    chatAgent.sendCallMetaData({
        content: {
            sender: 'callFull',
            eventType: 'showSticker',
            name: data[data.length - 1]
        }
    })
};
var imgSticker = document.getElementsByClassName("sticker");
for (var i = 0; i < imgSticker.length; i++) {
    imgSticker[i].addEventListener('click', sendSticker, false);
}

var sendTextSticker = function() {
    if(!callId) {
        console.warn("[call-full] Start video call to send text stickers");
        return;
    }

    let data = this.innerText;

    chatAgent.sendCallMetaData({
        content: {
            sender: 'callFull',
            eventType: 'showTextSticker',
            name: data
        }
    })
};
var textSticker = document.getElementsByClassName("text-sticker")
for (var i = 0; i < textSticker.length; i++) {
    textSticker[i].addEventListener('click', sendTextSticker, false);
}
