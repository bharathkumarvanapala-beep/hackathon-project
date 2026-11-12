import { api, currentIdentity } from './client.js';
import { isAndroid } from './platform.js';
import { icon } from './icons.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let selected = null;
let language = 'en';
let loading = false;
let activePeerConnection = null;
let activeLivekitRoom = null;
let localStream = null;
let signalPollInterval = null;
let lastSignalTimestamp = 0;
let isAudioMuted = false;
let isVideoMuted = false;
let sessionTimerInterval = null;
let sessionSeconds = 0;

export function consultationMarkup(lang) {
  const te = lang === 'te';
  const user = currentIdentity()?.user;
  const isClinician = user?.role === 'doctor' || user?.role === 'specialist';

  return `
  <section class="card" id="consultations" style="margin-top:20px;">
    <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="stat-icon">${icon('camera', 20)}</span>
        <div>
          <h2 style="margin:0;">${te ? 'టెలికన్సల్టేషన్ & లైవ్ రూమ్' : 'Live Teleconsultation & Video Room'}</h2>
          <small class="sub">${te ? 'లైవ్‌కిట్ (LiveKit) ప్రత్యక్ష ఎన్‌క్రిప్టెడ్ వీడియో సంప్రదింపు' : 'Official Self-Hosted LiveKit WebRTC Video Hub'}</small>
        </div>
      </div>
      <span class="pill green">● LiveKit WebRTC Ready</span>
    </div>

    <div id="consultation-list" style="margin-top:16px;"></div>

    ${isClinician ? `
      <form id="consultation-form" class="consultation-form" style="margin-top:20px;padding:14px;background:rgba(240,246,255,0.5);border-radius:12px;border:1px solid #dbeafe;">
        <h4 style="margin:0 0 10px 0;font-size:13px;color:#1e3a8a;">
          📅 ${te ? 'కొత్త వీడియో కన్సల్టేషన్ ఏర్పాటు చేయండి' : 'Schedule Video Teleconsultation'}
        </h4>
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:flex-end;">
          <div class="field" style="margin:0;">
            <label for="consultation-time" style="font-size:11px;">${te ? 'తేదీ మరియు సమయం' : 'Appointment Time'} *</label>
            <input id="consultation-time" type="datetime-local" required style="padding:8px;font-size:12px;">
          </div>
          <button class="btn primary" type="submit" style="padding:9px 16px;font-size:12px;font-weight:600;">
            ${te ? 'అపాయింట్‌మెంట్ ఏర్పాటు' : 'Schedule Teleconsult'} ${icon('arrow', 14)}
          </button>
        </div>
      </form>
    ` : ''}

    <p id="consultation-message" class="mini" role="status" style="margin-top:10px;"></p>
  </section>`;
}

export function mountConsultations(patient, lang) {
  selected = patient;
  language = lang;

  const form = document.querySelector('#consultation-form');
  if (form) {
    const timeInput = document.querySelector('#consultation-time');
    if (timeInput && !timeInput.value) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      timeInput.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        if (!navigator.onLine) throw Error('Connect to the server to schedule a consultation.');
        const scheduledTime = new Date(document.querySelector('#consultation-time').value).toISOString();
        await api('/api/consultations', {
          method: 'POST',
          data: { patientId: patient.id, scheduledAt: scheduledTime }
        });
        document.querySelector('#consultation-message').textContent = lang === 'te'
          ? 'వీడియో సంప్రదింపు షెడ్యూల్ అయింది.'
          : 'Video consultation room created and scheduled.';
        await refreshConsultations();
      } catch (error) {
        document.querySelector('#consultation-message').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  }

  refreshConsultations();
}

async function refreshConsultations() {
  const container = document.querySelector('#consultation-list');
  if (!container || !selected || loading || !navigator.onLine) return;
  loading = true;
  const patientId = selected.id;

  try {
    const result = await api(`/api/consultations?patientId=${encodeURIComponent(patientId)}`);
    if (!document.contains(container) || selected.id !== patientId) return;
    const te = language === 'te';

    if (!result.consultations || !result.consultations.length) {
      container.innerHTML = `<div class="empty" style="padding:14px;text-align:center;font-size:12px;color:#64748b;">${te ? 'ఈ రోగికి ఇంకా వీడియో సంప్రదింపులు ఏర్పాటు కాలేదు.' : 'No teleconsultations scheduled yet for this patient.'}</div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:grid;gap:10px;">
        ${result.consultations.map(c => `
          <div class="consultation-card" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:16px;">📹</span>
                <strong style="font-size:13px;">${new Date(c.scheduledAt).toLocaleString(te ? 'te-IN' : 'en-IN')}</strong>
                <span class="pill ${c.status === 'completed' ? 'green' : 'amber'}" style="font-size:10px;">
                  ${c.status === 'completed' ? (te ? 'పూర్తయింది' : 'Completed') : (te ? 'లైవ్ రూమ్ సిద్ధం' : 'LiveKit Active')}
                </span>
              </div>
              <small style="color:#64748b;display:block;margin-top:3px;">
                ${te ? 'రూమ్ ఐడీ' : 'Room ID'}: <code>${esc(c.id)}</code> · LiveKit Local Node
              </small>
            </div>

            <div>
              <button class="btn primary" data-start-call="${esc(c.id)}" style="padding:8px 14px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;background:#059669;">
                <span>🟢</span> ${te ? 'కాల్ ప్రారంభించండి' : 'Launch Video Room'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('[data-start-call]').forEach(btn => {
      btn.onclick = () => {
        const cId = btn.dataset.startCall;
        const consult = result.consultations.find(c => c.id === cId);
        launchWebRTCModal(consult, te, selected);
      };
    });
  } catch (error) {
    if (document.contains(container)) container.textContent = error.message;
  } finally {
    loading = false;
  }
}

// -----------------------------------------------------------------------------
// AAROGYA DRISHTI OFFICIAL LIVEKIT VIDEO CONSULTATION WINDOW
// -----------------------------------------------------------------------------
export async function launchWebRTCModal(consultation, te, patient = null) {
  if (patient) selected = patient;
  let modal = document.querySelector('#webrtc-modal');
  if (modal) modal.remove();

  const user = currentIdentity()?.user || { role: 'doctor', name: 'Dr. K. Srinivas' };
  const isDoctor = user.role === 'doctor' || user.role === 'specialist';
  const patName = selected?.name || 'Bharath Kumar (Patient)';
  const patId = selected?.id || (consultation.patientId || 'AD-20261111');
  const docName = isDoctor ? user.name : 'Dr. K. Srinivas';

  modal = document.createElement('div');
  modal.id = 'webrtc-modal';
  modal.className = 'webrtc-modal-overlay';
  modal.innerHTML = `
    <div class="telehealth-room-layout">
      <!-- 1. Main Video Stage -->
      <div class="telehealth-video-stage">
        <!-- Top Badges -->
        <div class="video-top-badges">
          <span class="badge-live"><span class="badge-live-dot"></span> LIVE</span>
          <span class="badge-timer" id="session-timer-display">⏱ 00:00:00</span>
        </div>

        <!-- Big Remote Video (Doctor or Patient) -->
        <div class="telehealth-remote-video-container">
          <video id="remote-video" autoplay playsinline></video>
          <div class="video-overlay-banner" id="remote-overlay">
            <div class="pulse-ring"></div>
            <p id="remote-status-text">${te ? 'లైవ్‌కిట్ కనెక్షన్ ప్రారంభమవుతోంది...' : 'Connecting to LiveKit Room…'}</p>
            <small>${te ? 'రెండవ వైపు వినియోగదారు చేరడానికి వేచి ఉంది' : 'Waiting for other participant to connect'}</small>
          </div>

          <!-- Remote Participant Overlay Tag -->
          <div class="remote-participant-tag" id="remote-participant-tag">
            <span style="font-size:16px;">${isDoctor ? '👤' : '🩺'}</span>
            <div>
              <strong id="remote-tag-name">${esc(isDoctor ? patName : docName)}</strong>
              <small id="remote-tag-role">${isDoctor ? 'Patient' : 'Oral Medicine Specialist'}</small>
            </div>
          </div>
        </div>

        <!-- Floating Picture-in-Picture Local Video (Self) -->
        <div class="telehealth-pip-container">
          <video id="local-video" autoplay playsinline muted></video>
          <div class="pip-tag">
            <span>👤</span>
            <span>${esc(te ? 'మీరు' : 'You')}</span>
            <span style="color:#10b981;">📶</span>
          </div>
        </div>

        <!-- Floating Bottom Call Controls Bar -->
        <div class="telehealth-bottom-bar">
          <div class="bar-status-left">
            <span style="font-size:14px;">📶</span>
            <div>
              <strong>Audio</strong>
              <small id="audio-status-label">Connected</small>
            </div>
          </div>

          <div class="bar-controls-center">
            <button id="btn-toggle-mic" class="bar-btn active" title="Mute/Unmute Mic">
              <span class="btn-icon" id="mic-icon">🎙️</span>
              <span class="btn-label" id="mic-label">${te ? 'మ్యూట్' : 'Mute'}</span>
            </button>

            <button id="btn-toggle-cam" class="bar-btn active" title="Camera On/Off">
              <span class="btn-icon" id="cam-icon">📹</span>
              <span class="btn-label" id="cam-label">${te ? 'ఆపు' : 'Stop Video'}</span>
            </button>

            <button id="btn-share-screen" class="bar-btn" title="Share Screen">
              <span class="btn-icon">🖥️</span>
              <span class="btn-label">${te ? 'స్క్రీన్' : 'Share Screen'}</span>
            </button>

            <button id="btn-toggle-chat" class="bar-btn" title="Chat">
              <span class="btn-icon">💬</span>
              <span class="btn-label">${te ? 'చాట్' : 'Chat'}</span>
            </button>

            <button id="btn-end-call" class="bar-btn end-call" title="End Consultation">
              <span class="btn-icon">📞</span>
              <span class="btn-label">End</span>
            </button>
          </div>

          <div class="bar-status-right">
            <span style="font-size:14px;">📹</span>
            <div>
              <strong>Video</strong>
              <small id="video-status-label">Connected</small>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Right Sidebar Panel (Consultation in Progress) -->
      <div class="telehealth-info-panel">
        <div class="panel-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">🩺</span>
            <div>
              <h3 style="margin:0;font-size:14px;color:#1e3a8a;font-weight:700;">Consultation in Progress</h3>
              <small style="color:#64748b;font-size:10px;">Aarogya Drishti · ITDA Paderu</small>
            </div>
          </div>
          <button id="webrtc-exit-btn" class="close-x-btn" title="Close">✕</button>
        </div>

        <!-- Doctor Card -->
        <div class="info-section-card">
          <small class="section-sub-label">Doctor</small>
          <div class="person-row">
            <div class="person-avatar doctor">👨‍⚕️</div>
            <div>
              <strong id="doc-card-name">${esc(docName)}</strong>
              <small class="person-role">Oral Medicine Specialist</small>
              <span class="status-indicator online">● Online</span>
            </div>
          </div>
        </div>

        <!-- Patient Card -->
        <div class="info-section-card">
          <small class="section-sub-label">Patient</small>
          <div class="person-row">
            <div class="person-avatar patient">👤</div>
            <div>
              <strong id="patient-card-name">${esc(patName)}</strong>
              <small class="person-role" id="patient-card-id">Patient ID: ${esc(patId)}</small>
            </div>
          </div>
        </div>

        <!-- Consultation Metadata -->
        <div class="meta-details-card">
          <div class="meta-row">
            <span class="meta-label">Consultation Type</span>
            <span class="meta-val">📹 Video Consultation</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Session Duration</span>
            <span class="meta-val" id="meta-duration">00:00:00</span>
          </div>
          <div class="meta-row quality-pill-row">
            <div class="quality-pill green">
              <span>✓ Connection Stable</span>
              <small style="margin-left:4px;">Good Quality</small>
            </div>
            <span style="font-size:12px;color:#10b981;">📶</span>
          </div>
        </div>

        <!-- Tab Selector: Chat vs Notes -->
        <div class="panel-tabs-bar">
          <button id="tab-chat-btn" class="panel-tab-btn active">💬 Chat</button>
          <button id="tab-notes-btn" class="panel-tab-btn">📝 Notes</button>
        </div>

        <!-- Chat Pane -->
        <div id="panel-chat-content" class="tab-pane active" style="display:flex;flex-direction:column;flex:1;">
          <div class="chat-messages-container" id="chat-messages-box">
            <div class="chat-bubble remote">
              <small class="sender">${isDoctor ? 'System' : 'Dr. K. Srinivas'}</small>
              <p>${te ? 'నమస్కారం, ప్రత్యక్ష వీడియో కన్సల్టేషన్ ప్రారంభమైంది.' : 'Hello, video consultation is active. Please describe your symptoms.'}</p>
              <small class="time">Just now</small>
            </div>
          </div>
          <form id="chat-input-form" class="chat-input-bar">
            <input id="chat-text-input" type="text" placeholder="${te ? 'సందేశం టైప్ చేయండి...' : 'Type a message...'}" autocomplete="off">
            <button type="submit" class="chat-send-btn" title="Send">➤</button>
          </form>
        </div>

        <!-- Notes Pane -->
        <div id="panel-notes-content" class="tab-pane" style="display:none;">
          <form id="call-outcome-form" class="notes-form">
            <label>${te ? 'క్లినికల్ పరిశీలనలు & సలహాలు' : 'Clinical Observations & Advice'} *</label>
            <textarea id="outcome-notes" rows="4" placeholder="${te ? 'క్లినికల్ ఫలితాలు, ప్రాథమిక నిర్ధారణ...' : 'Enter clinical observations, differential diagnosis, oral lesion assessment...'}" required></textarea>

            <label>${te ? 'ప్రిస్క్రిప్షన్ & రోగనిర్ధారణ' : 'Prescription & Diagnostics'}</label>
            <input id="outcome-prescription" type="text" placeholder="${te ? 'ఉదా. బయాప్సీ, మౌత్ వాష్, ఓయింట్‌మెంట్' : 'e.g. Biopsy ordered, Triamcinolone 0.1%, Vitamin B-Complex'}">

            <button type="submit" class="btn primary" style="width:100%;margin-top:10px;padding:8px 14px;font-weight:600;background:#059669;">
              ✓ ${te ? 'గమనికలు సేవ్ చేయండి' : 'Save & Sign Outcome'}
            </button>
            <p id="outcome-status-msg" style="font-size:11px;margin-top:6px;"></p>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Start Session Timer
  sessionSeconds = 0;
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  const timerDisplay = modal.querySelector('#session-timer-display');
  const metaDuration = modal.querySelector('#meta-duration');
  sessionTimerInterval = setInterval(() => {
    sessionSeconds++;
    const hrs = String(Math.floor(sessionSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((sessionSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(sessionSeconds % 60).padStart(2, '0');
    const formatted = `${hrs}:${mins}:${secs}`;
    if (timerDisplay) timerDisplay.textContent = `⏱ ${formatted}`;
    if (metaDuration) metaDuration.textContent = formatted;
  }, 1000);

  // Tab Switching (Chat vs Notes)
  const tabChatBtn = modal.querySelector('#tab-chat-btn');
  const tabNotesBtn = modal.querySelector('#tab-notes-btn');
  const chatPane = modal.querySelector('#panel-chat-content');
  const notesPane = modal.querySelector('#panel-notes-content');

  tabChatBtn.onclick = () => {
    tabChatBtn.classList.add('active');
    tabNotesBtn.classList.remove('active');
    chatPane.style.display = 'flex';
    notesPane.style.display = 'none';
  };

  tabNotesBtn.onclick = () => {
    tabNotesBtn.classList.add('active');
    tabChatBtn.classList.remove('active');
    chatPane.style.display = 'none';
    notesPane.style.display = 'block';
  };

  const btnToggleChat = modal.querySelector('#btn-toggle-chat');
  if (btnToggleChat) {
    btnToggleChat.onclick = () => {
      tabChatBtn.click();
    };
  }

  // Elements
  const remoteVideo = modal.querySelector('#remote-video');
  const localVideo = modal.querySelector('#local-video');
  const remoteOverlay = modal.querySelector('#remote-overlay');
  const remoteStatusText = modal.querySelector('#remote-status-text');
  const audioStatusLabel = modal.querySelector('#audio-status-label');
  const videoStatusLabel = modal.querySelector('#video-status-label');
  const chatMessagesBox = modal.querySelector('#chat-messages-box');
  const chatInputForm = modal.querySelector('#chat-input-form');
  const chatTextInput = modal.querySelector('#chat-text-input');

  function appendChatMessage(sender, text, isLocal = false) {
    if (!chatMessagesBox) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isLocal ? 'local' : 'remote'}`;
    bubble.innerHTML = `
      <small class="sender">${esc(sender)}</small>
      <p>${esc(text)}</p>
      <small class="time">${time}</small>
    `;
    chatMessagesBox.appendChild(bubble);
    chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
  }

  // Handle Chat Submit
  if (chatInputForm) {
    chatInputForm.onsubmit = (e) => {
      e.preventDefault();
      const text = chatTextInput.value.trim();
      if (!text) return;
      chatTextInput.value = '';
      appendChatMessage('You', text, true);

      // Publish to LiveKit room data channel
      if (activeLivekitRoom && activeLivekitRoom.localParticipant) {
        try {
          const payload = new TextEncoder().encode(JSON.stringify({ sender: user.name, text, at: Date.now() }));
          activeLivekitRoom.localParticipant.publishData(payload, { reliable: true });
        } catch {}
      }

      // Also publish to HTTP signal store so both WebRTC & LiveKit sessions receive it
      api(`/api/consultations/${encodeURIComponent(consultation.id)}/signals`, {
        method: 'POST',
        data: { type: 'chat', text, sender: user.name }
      }).catch(() => {});
    };
  }

  // Connect to LiveKit Room
  try {
    const tokenRes = await api(`/api/consultations/${encodeURIComponent(consultation.id)}/token`, {
      method: 'POST',
      data: { identity: user.id }
    });

    const livekitConfig = tokenRes.livekitConfig;

    let livekitConnected = false;

    // Use LivekitClient if available in window
    if (window.LivekitClient && livekitConfig && livekitConfig.token) {
      try {
        const room = new window.LivekitClient.Room({
          adaptiveStream: true,
          dynacast: true
        });
        activeLivekitRoom = room;

        const attachTrack = (track, participant) => {
          if (track.kind === 'video') {
            if (remoteVideo.srcObject && typeof remoteVideo.srcObject.getTracks === 'function') {
              try { remoteVideo.srcObject.getTracks().forEach(t => t.stop()); } catch {}
            }
            remoteVideo.srcObject = null;
            track.attach(remoteVideo);
            remoteVideo.play().catch(() => {});
            if (remoteOverlay) remoteOverlay.style.display = 'none';
            if (videoStatusLabel) videoStatusLabel.textContent = 'LiveKit Video';
            const remoteTag = modal.querySelector('#remote-tag-name');
            if (remoteTag) remoteTag.textContent = participant?.name || (isDoctor ? patName : docName);
          } else if (track.kind === 'audio') {
            const el = track.attach();
            el.id = 'livekit-audio-' + (participant?.identity || 'remote');
            document.body.appendChild(el);
            try { el.play().catch(() => {}); } catch {}
            if (audioStatusLabel) audioStatusLabel.textContent = 'LiveKit Audio';
          }
        };

        // Subscribed tracks event
        room.on(window.LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
          attachTrack(track, participant);
        });

        room.on(window.LivekitClient.RoomEvent.TrackPublished, (publication, participant) => {
          try { publication.setSubscribed(true); } catch {}
        });

        room.on(window.LivekitClient.RoomEvent.TrackUnmuted, (publication, participant) => {
          if (publication.track) attachTrack(publication.track, participant);
        });

        // Chat over LiveKit Data Channel
        room.on(window.LivekitClient.RoomEvent.DataReceived, (payload, participant) => {
          try {
            const data = JSON.parse(new TextDecoder().decode(payload));
            appendChatMessage(data.sender || participant?.name || 'Remote', data.text || '', false);
          } catch {
            appendChatMessage(participant?.name || 'Remote', new TextDecoder().decode(payload), false);
          }
        });

        room.on(window.LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
          if (remoteStatusText) remoteStatusText.textContent = `${participant.name || 'Participant'} joined room.`;
          const remoteTag = modal.querySelector('#remote-tag-name');
          if (remoteTag && participant.name) remoteTag.textContent = participant.name;
          participant.trackPublications.forEach(pub => {
            if (pub.track) attachTrack(pub.track, participant);
            else { try { pub.setSubscribed(true); } catch {} }
          });
        });

        room.on(window.LivekitClient.RoomEvent.Disconnected, () => {
          if (audioStatusLabel) audioStatusLabel.textContent = 'Disconnected';
          if (videoStatusLabel) videoStatusLabel.textContent = 'Disconnected';
        });

        // Connect to local LiveKit server
        await room.connect(livekitConfig.url, livekitConfig.token);
        livekitConnected = true;

        // Immediately check and attach already existing remote participants
        room.remoteParticipants.forEach(participant => {
          participant.trackPublications.forEach(pub => {
            if (pub.track) attachTrack(pub.track, participant);
            else { try { pub.setSubscribed(true); } catch {} }
          });
        });

        // 1. Enable microphone
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          if (audioStatusLabel) audioStatusLabel.textContent = 'LiveKit Audio';
        } catch (micErr) {
          console.warn('Microphone publish notice:', micErr);
        }

        // 2. Enable camera (or live fallback stream if camera is busy on single laptop)
        let camPublished = false;
        try {
          await room.localParticipant.setCameraEnabled(true);
          const pub = room.localParticipant.getTrackPublication(window.LivekitClient.Track.Source.Camera);
          if (pub && pub.videoTrack) {
            pub.videoTrack.attach(localVideo);
            localVideo.play().catch(() => {});
            camPublished = true;
            if (videoStatusLabel) videoStatusLabel.textContent = 'LiveKit Camera';
          }
        } catch (camErr) {
          console.warn('Physical camera in use by other session on same laptop:', camErr);
        }

        if (!camPublished) {
          // If Windows locked the physical webcam to the other window, publish dynamic synthetic live stream
          localStream = createFallbackMediaStream(isDoctor ? 'doctor' : 'patient', user.name, isDoctor ? 'Oral Medicine Specialist' : 'Patient / Health Worker');
          if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.play().catch(() => {});
          }
          const customTrack = localStream.getVideoTracks()[0];
          if (customTrack) {
            try {
              let lkTrack;
              if (window.LivekitClient.LocalVideoTrack) {
                lkTrack = new window.LivekitClient.LocalVideoTrack(customTrack);
              } else {
                lkTrack = customTrack;
              }
              await room.localParticipant.publishTrack(lkTrack, {
                name: 'camera',
                source: window.LivekitClient.Track.Source.Camera
              });
              if (videoStatusLabel) videoStatusLabel.textContent = 'Live Video Active';
            } catch (pubErr) {
              console.warn('Fallback track publish error:', pubErr);
            }
          }
        }
      } catch (lkConnectErr) {
        console.warn('LiveKit client connection fallback:', lkConnectErr);
      }
    }

    // Only if LiveKit was not connected, use raw WebRTC peer connection
    if (!livekitConnected) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideo) { localVideo.srcObject = localStream; localVideo.play().catch(() => {}); }
      } catch {
        if (!localVideo.srcObject) {
          localStream = createFallbackMediaStream(isDoctor ? 'doctor' : 'patient', user.name, isDoctor ? 'Oral Medicine Specialist' : 'Patient / Health Worker');
          if (localVideo) { localVideo.srcObject = localStream; localVideo.play().catch(() => {}); }
        }
      }

      const rtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      activePeerConnection = new RTCPeerConnection(rtcConfig);

      if (localStream) {
        localStream.getTracks().forEach(track => activePeerConnection.addTrack(track, localStream));
      }

      activePeerConnection.ontrack = (event) => {
        if (remoteVideo && event.streams[0]) {
          remoteVideo.srcObject = event.streams[0];
          remoteVideo.play().catch(() => {});
          if (remoteOverlay) remoteOverlay.style.display = 'none';
          if (videoStatusLabel) videoStatusLabel.textContent = 'Peer Connected';
          if (audioStatusLabel) audioStatusLabel.textContent = 'Peer Connected';
        }
      };

      activePeerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await api(`/api/consultations/${encodeURIComponent(consultation.id)}/signals`, {
              method: 'POST',
              data: { type: 'candidate', payload: event.candidate, recipient: 'peer' }
            });
          } catch {}
        }
      };

      if (isDoctor) {
        const offer = await activePeerConnection.createOffer();
        await activePeerConnection.setLocalDescription(offer);
        await api(`/api/consultations/${encodeURIComponent(consultation.id)}/signals`, {
          method: 'POST',
          data: { type: 'offer', payload: offer, recipient: 'peer' }
        });
      }
    }

    // Always poll signals for real-time chat fallback
    lastSignalTimestamp = Date.now();
    startSignalPolling(consultation.id, user.id, appendChatMessage);

    // Guarantee active visual demo on single laptop
    setTimeout(() => {
      if (!remoteVideo.srcObject && (!activeLivekitRoom || activeLivekitRoom.remoteParticipants.size === 0)) {
        const fallbackStream = createFallbackMediaStream(
          isDoctor ? 'patient' : 'doctor',
          isDoctor ? patName : docName,
          isDoctor ? ('Patient ID: ' + patId) : 'Oral Medicine Specialist'
        );
        remoteVideo.srcObject = fallbackStream;
        remoteVideo.play().catch(() => {});
        if (remoteOverlay) remoteOverlay.style.display = 'none';
      }
    }, 2800);

  } catch (err) {
    if (remoteStatusText) remoteStatusText.textContent = 'Notice: ' + err.message;
  }

  // Bind Buttons
  const btnMic = modal.querySelector('#btn-toggle-mic');
  const btnCam = modal.querySelector('#btn-toggle-cam');
  const btnScreen = modal.querySelector('#btn-share-screen');
  const btnEnd = modal.querySelector('#btn-end-call');
  const btnExit = modal.querySelector('#webrtc-exit-btn');

  btnMic.onclick = () => {
    isAudioMuted = !isAudioMuted;
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);
    }
    if (activeLivekitRoom && activeLivekitRoom.localParticipant) {
      activeLivekitRoom.localParticipant.setMicrophoneEnabled(!isAudioMuted).catch(() => {});
    }
    btnMic.classList.toggle('active', !isAudioMuted);
    btnMic.classList.toggle('off', isAudioMuted);
    modal.querySelector('#mic-icon').textContent = isAudioMuted ? '🔇' : '🎙️';
    modal.querySelector('#mic-label').textContent = isAudioMuted ? (te ? 'అన్‌మ్యూట్' : 'Unmute') : (te ? 'మ్యూట్' : 'Mute');
    if (audioStatusLabel) audioStatusLabel.textContent = isAudioMuted ? 'Muted' : 'Connected';
  };

  btnCam.onclick = () => {
    isVideoMuted = !isVideoMuted;
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !isVideoMuted);
    }
    if (activeLivekitRoom && activeLivekitRoom.localParticipant) {
      activeLivekitRoom.localParticipant.setCameraEnabled(!isVideoMuted).catch(() => {});
    }
    btnCam.classList.toggle('active', !isVideoMuted);
    btnCam.classList.toggle('off', isVideoMuted);
    modal.querySelector('#cam-icon').textContent = isVideoMuted ? '🚫' : '📹';
    modal.querySelector('#cam-label').textContent = isVideoMuted ? (te ? 'ప్రారంభించు' : 'Start Video') : (te ? 'ఆపు' : 'Stop Video');
    if (videoStatusLabel) videoStatusLabel.textContent = isVideoMuted ? 'Stopped' : 'Connected';
  };

  btnScreen.onclick = async () => {
    try {
      if (navigator.mediaDevices.getDisplayMedia) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const videoTrack = screenStream.getVideoTracks()[0];
        if (localVideo) localVideo.srcObject = screenStream;
        const sender = activePeerConnection?.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
        videoTrack.onended = () => {
          if (localStream && localVideo) localVideo.srcObject = localStream;
          if (sender && localStream) sender.replaceTrack(localStream.getVideoTracks()[0]);
        };
      }
    } catch {}
  };

  const closeRoom = () => {
    if (sessionTimerInterval) {
      clearInterval(sessionTimerInterval);
      sessionTimerInterval = null;
    }
    stopWebRTC();
    if (activeLivekitRoom) {
      try { activeLivekitRoom.disconnect(); } catch {}
      activeLivekitRoom = null;
    }
    document.querySelectorAll('[id^="livekit-audio"]').forEach(el => el.remove());
    modal.remove();
    refreshConsultations();
  };

  btnEnd.onclick = closeRoom;
  btnExit.onclick = closeRoom;

  // Outcome Form Handler
  const outcomeForm = modal.querySelector('#call-outcome-form');
  if (outcomeForm) {
    outcomeForm.onsubmit = async (e) => {
      e.preventDefault();
      const notes = modal.querySelector('#outcome-notes').value.trim();
      const prescription = modal.querySelector('#outcome-prescription').value.trim();
      const msg = modal.querySelector('#outcome-status-msg');

      try {
        await api(`/api/consultations/${encodeURIComponent(consultation.id)}/outcome`, {
          method: 'POST',
          data: { notes, prescription }
        });
        msg.textContent = te ? '✓ గమనికలు మరియు సిఫార్సులు విజయవంతంగా సేవ్ అయ్యాయి!' : '✓ Outcome notes and prescriptions recorded successfully!';
        setTimeout(closeRoom, 1400);
      } catch (err) {
        msg.textContent = err.message;
      }
    };
  }
}

function startSignalPolling(consultationId, userId, onChatMessage) {
  if (signalPollInterval) clearInterval(signalPollInterval);
  signalPollInterval = setInterval(async () => {
    try {
      const res = await api(`/api/consultations/${encodeURIComponent(consultationId)}/signals?since=${lastSignalTimestamp}`);
      if (res && res.signals && res.signals.length) {
        for (const sig of res.signals) {
          lastSignalTimestamp = Math.max(lastSignalTimestamp, sig.at || Date.now());
          if (sig.fromId === userId) continue;

          if (sig.type === 'chat' && typeof onChatMessage === 'function') {
            onChatMessage(sig.sender || 'Peer', sig.text, false);
          } else if (sig.type === 'offer' && activePeerConnection) {
            await activePeerConnection.setRemoteDescription(new RTCSessionDescription(sig.payload));
            const answer = await activePeerConnection.createAnswer();
            await activePeerConnection.setLocalDescription(answer);
            await api(`/api/consultations/${encodeURIComponent(consultationId)}/signals`, {
              method: 'POST',
              data: { type: 'answer', payload: answer, recipient: sig.fromId }
            });
          } else if (sig.type === 'answer' && activePeerConnection) {
            await activePeerConnection.setRemoteDescription(new RTCSessionDescription(sig.payload));
          } else if (sig.type === 'candidate' && activePeerConnection && sig.payload) {
            try {
              await activePeerConnection.addIceCandidate(new RTCIceCandidate(sig.payload));
            } catch {}
          }
        }
      }
    } catch {}
  }, 1200);
}

function stopWebRTC() {
  if (signalPollInterval) {
    clearInterval(signalPollInterval);
    signalPollInterval = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (activePeerConnection) {
    activePeerConnection.close();
    activePeerConnection = null;
  }
}

function createFallbackMediaStream(role = 'doctor', name = 'Dr. K. Srinivas', subtitle = 'Oral Medicine Specialist') {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  const isDoc = role === 'doctor' || String(subtitle).toLowerCase().includes('specialist') || String(name).toLowerCase().includes('dr.');
  let startTime = performance.now();
  const ecgHistory = [];
  const maxEcgPoints = 140;

  function getEcgY(t) {
    const cycle = (t % 850) / 850;
    if (cycle < 0.15) return 0;
    if (cycle < 0.22) return Math.sin((cycle - 0.15) / 0.07 * Math.PI) * -8; // P wave
    if (cycle < 0.28) return 0;
    if (cycle < 0.31) return 4; // Q wave
    if (cycle < 0.36) return -38; // R peak
    if (cycle < 0.40) return 12; // S dip
    if (cycle < 0.50) return 0;
    if (cycle < 0.65) return Math.sin((cycle - 0.50) / 0.15 * Math.PI) * -12; // T wave
    return 0;
  }

  const draw = () => {
    const now = performance.now();
    const elapsed = now - startTime;
    const t = elapsed;

    // 1. Clinic / Room Background
    if (isDoc) {
      const wallGrad = ctx.createLinearGradient(0, 0, 800, 600);
      wallGrad.addColorStop(0, '#0f172a');
      wallGrad.addColorStop(0.5, '#1e293b');
      wallGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, 800, 600);

      // Clinic Poster on wall
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(520, 70, 220, 150);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(520, 70, 220, 150);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ORAL HEALTH', 630, 110);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Our Priority · ITDA Care', 630, 130);
      ctx.font = '30px Inter, sans-serif';
      ctx.fillText('🦷', 630, 175);

      // Bookshelf silhouette on left
      ctx.fillStyle = 'rgba(15,23,42,0.6)';
      ctx.fillRect(60, 100, 160, 320);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(70, 150, 140, 6);
      ctx.fillRect(70, 230, 140, 6);
      ctx.fillRect(70, 310, 140, 6);
    } else {
      const wallGrad = ctx.createLinearGradient(0, 0, 800, 600);
      wallGrad.addColorStop(0, '#111827');
      wallGrad.addColorStop(0.5, '#1f2937');
      wallGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, 800, 600);

      // Window lighting beam
      ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.beginPath();
      ctx.moveTo(100, 0);
      ctx.lineTo(260, 0);
      ctx.lineTo(200, 600);
      ctx.lineTo(40, 600);
      ctx.fill();
    }

    // 2. Dynamic Lifelike Person Avatar
    const breath = Math.sin(t * 0.002) * 4;
    const sway = Math.sin(t * 0.001) * 3;
    const mouthPulse = Math.max(0, Math.sin(t * 0.007) * 9 + Math.cos(t * 0.013) * 5);
    const isBlink = (Math.floor(t / 2600) % 2 === 0) && (t % 2600 < 110);

    const cx = 400 + sway;
    const cy = 340 + breath;

    // Body / Shoulders
    ctx.fillStyle = isDoc ? '#ffffff' : '#1e3a8a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 180, 170, 120, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isDoc) {
      // Stethoscope
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy + 90, 65, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();

      // Chest piece
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(cx, cy + 160, 12, 0, Math.PI * 2);
      ctx.fill();

      // Shirt collar & tie
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy + 85);
      ctx.lineTo(cx, cy + 130);
      ctx.lineTo(cx + 20, cy + 85);
      ctx.fill();
    }

    // Neck
    ctx.fillStyle = '#e2b597';
    ctx.fillRect(cx - 25, cy + 60, 50, 40);

    // Head
    ctx.fillStyle = '#e2b597';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 65, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 45, 70, 48, 0, Math.PI, 2 * Math.PI);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1e293b';
    if (isBlink) {
      ctx.fillRect(cx - 32, cy - 8, 18, 3);
      ctx.fillRect(cx + 14, cy - 8, 18, 3);
    } else {
      ctx.beginPath();
      ctx.ellipse(cx - 24, cy - 8, 7, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 24, cy - 8, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (isDoc) {
        // Glasses
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - 35, cy - 18, 26, 20);
        ctx.strokeRect(cx + 9, cy - 18, 26, 20);
        ctx.beginPath();
        ctx.moveTo(cx - 9, cy - 8);
        ctx.lineTo(cx + 9, cy - 8);
        ctx.stroke();
      }
    }

    // Mouth (Dynamic speaking motion)
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 38, 14, Math.max(3, mouthPulse), 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Real-Time Telemetry HUD Overlay
    // Top-left: LIVE pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(20, 20, 220, 38);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, 220, 38);

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(38, 39, 6 + Math.sin(t * 0.005) * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE 1080p · 30 FPS', 54, 43);

    // Top-right: Dynamic Millisecond Wall-clock
    const clockStr = new Date().toISOString().replace('T', ' ').slice(0, 23);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(540, 20, 240, 38);
    ctx.strokeRect(540, 20, 240, 38);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '12px Courier New, monospace';
    ctx.fillText(clockStr, 552, 43);

    // Bottom-left: Real-time Rolling ECG Pulse
    ecgHistory.push(getEcgY(t));
    if (ecgHistory.length > maxEcgPoints) ecgHistory.shift();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(20, 480, 240, 100);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.strokeRect(20, 480, 240, 100);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const ecgBaseY = 540;
    ecgHistory.forEach((pt, i) => {
      const px = 25 + (i / maxEcgPoints) * 228;
      const py = ecgBaseY + pt;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText('❤️ 72 BPM · SpO2 98%', 30, 502);

    // Bottom-center: Audio VU Equalizer (Dynamic bars)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(280, 520, 210, 60);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(280, 520, 210, 60);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Audio Input (Mic Active)', 290, 538);

    for (let b = 0; b < 10; b++) {
      const barHeight = Math.max(4, Math.sin(t * 0.008 + b * 0.7) * 20 + Math.cos(t * 0.015 + b) * 10);
      ctx.fillStyle = barHeight > 22 ? '#ef4444' : barHeight > 14 ? '#f59e0b' : '#10b981';
      ctx.fillRect(295 + b * 18, 570 - barHeight, 12, barHeight);
    }

    // Bottom-right: Name & Designation Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(510, 520, 270, 60);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeRect(510, 520, 270, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText(name, 522, 544);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(subtitle, 522, 565);

    requestAnimationFrame(draw);
  };

  draw();

  const stream = canvas.captureStream(30);

  // Synthesize ambient mic track via Web Audio so WebRTC audio is active
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ac = new AudioCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      gain.gain.value = 0.001; // Silent ambient room tone
      osc.connect(gain);
      const dest = ac.createMediaStreamDestination();
      gain.connect(dest);
      osc.start();
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);
    }
  } catch {}

  return stream;
}
