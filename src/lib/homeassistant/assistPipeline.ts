// ── Assist voice pipeline ─────────────────────────────────────────────────────
// Streams microphone audio into HA's `assist_pipeline/run` (STT → intent →
// TTS) over the existing WebSocket. Audio frames are raw 16-bit mono PCM,
// prefixed with the 1-byte binary handler id HA assigns in `run-start`; an
// empty frame (just the handler byte) marks end-of-audio. HA's own VAD ends
// the utterance on silence, so a session normally completes hands-free.

import { getConnection, getRestUrl, waitForConnection } from './connection';

interface PipelineEvent {
  type: string;
  data?: {
    runner_data?: { stt_binary_handler_id?: number };
    stt_output?: { text?: string };
    intent_output?: {
      conversation_id?: string | null;
      response?: { speech?: { plain?: { speech?: string } } };
    };
    tts_output?: { url?: string };
    code?: string;
    message?: string;
  };
}

export interface VoiceAssistCallbacks {
  /** Pipeline accepted the run and the mic is streaming. */
  onListening?: () => void;
  /** Final speech-to-text result — what the user said. */
  onTranscript?: (text: string) => void;
  /** Assist's reply (and the conversation id to continue the thread). */
  onReply?: (speech: string, conversationId: string | null) => void;
  onError?: (message: string) => void;
  /** Session over — mic released (fires on success, error, and manual stop). */
  onEnd?: () => void;
}

export interface VoiceAssistSession {
  /** End the utterance early (HA then finishes STT on what it heard). */
  stop: () => void;
}

/**
 * Run one voice interaction against the default Assist pipeline. Resolves to
 * null (after calling onError) when there's no connection or no microphone.
 */
export async function startVoiceAssist(
  callbacks: VoiceAssistCallbacks,
  conversationId?: string | null,
): Promise<VoiceAssistSession | null> {
  const conn = getConnection() ?? await waitForConnection();
  if (!conn) {
    callbacks.onError?.('I need a live Home Assistant connection to hear you.');
    return null;
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    callbacks.onError?.('Microphone access was denied.');
    return null;
  }

  // 16 kHz mono is what HA's STT engines expect; the AudioContext resamples.
  const ctx = new AudioContext({ sampleRate: 16000 });
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);

  let handlerId: number | null = null;
  let unsubscribe: (() => Promise<void>) | null = null;
  let finished = false;

  const socket = (conn as unknown as { socket: { send: (data: ArrayBufferLike | ArrayBufferView) => void } }).socket;

  const sendAudio = (samples: Float32Array) => {
    if (handlerId == null) return;
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const frame = new Uint8Array(1 + pcm.byteLength);
    frame[0] = handlerId;
    frame.set(new Uint8Array(pcm.buffer), 1);
    try { socket.send(frame); } catch { /* socket died — error event follows */ }
  };

  const releaseMic = () => {
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };

  const endAudio = () => {
    if (handlerId == null) return;
    try { socket.send(new Uint8Array([handlerId])); } catch { /* ignore */ }
    handlerId = null;
    releaseMic();
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    endAudio();
    releaseMic();
    unsubscribe?.().catch(() => {});
    callbacks.onEnd?.();
  };

  processor.onaudioprocess = (e) => sendAudio(e.inputBuffer.getChannelData(0));
  source.connect(processor);
  // ScriptProcessor only fires while wired into the graph; a zero-gain sink
  // keeps the mic out of the speakers.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  processor.connect(sink);
  sink.connect(ctx.destination);

  const handleEvent = (event: PipelineEvent) => {
    switch (event.type) {
      case 'run-start': {
        handlerId = event.data?.runner_data?.stt_binary_handler_id ?? null;
        if (handlerId == null) {
          callbacks.onError?.('This Assist pipeline has no speech-to-text engine.');
          finish();
          return;
        }
        callbacks.onListening?.();
        break;
      }
      case 'stt-end': {
        // Utterance captured (VAD or manual stop) — mic no longer needed.
        handlerId = null;
        releaseMic();
        const text = event.data?.stt_output?.text?.trim();
        if (text) callbacks.onTranscript?.(text);
        break;
      }
      case 'intent-end': {
        const speech = event.data?.intent_output?.response?.speech?.plain?.speech;
        callbacks.onReply?.(speech || 'Done!', event.data?.intent_output?.conversation_id ?? null);
        break;
      }
      case 'tts-end': {
        const url = event.data?.tts_output?.url;
        const base = getRestUrl();
        if (url && base) {
          const audio = new Audio(url.startsWith('http') ? url : `${base}${url}`);
          audio.play().catch(() => {});
        }
        break;
      }
      case 'error': {
        callbacks.onError?.(event.data?.message ?? 'Assist ran into an error.');
        finish();
        break;
      }
      case 'run-end': {
        finish();
        break;
      }
    }
  };

  try {
    unsubscribe = await conn.subscribeMessage<PipelineEvent>(handleEvent, {
      type: 'assist_pipeline/run',
      start_stage: 'stt',
      end_stage: 'tts',
      input: { sample_rate: ctx.sampleRate },
      ...(conversationId ? { conversation_id: conversationId } : {}),
    });
  } catch {
    releaseMic();
    callbacks.onError?.('Voice assist is not available on this Home Assistant instance.');
    callbacks.onEnd?.();
    return null;
  }

  return { stop: endAudio };
}
